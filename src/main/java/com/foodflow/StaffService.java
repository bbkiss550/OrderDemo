package com.foodflow;

import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StaffService implements ApplicationRunner {
    private final JdbcTemplate db;private final AuditService audit;private final PasswordEncoder passwords;
    private final String bootstrapUsername,bootstrapPassword;
    public StaffService(JdbcTemplate db,AuditService audit,PasswordEncoder passwords,
            @Value("${ADMIN_USERNAME:admin}") String username,@Value("${ADMIN_PASSWORD}") String password){
        this.db=db;this.audit=audit;this.passwords=passwords;this.bootstrapUsername=username;this.bootstrapPassword=password;
    }
    public record Input(@NotBlank @Pattern(regexp="[A-Za-z0-9._-]{3,60}") String username,
            @NotBlank @Size(max=100) String displayName,@NotNull @Pattern(regexp="ADMIN|CASHIER|KITCHEN") String role,
            boolean active,@PositiveOrZero long version,@Size(max=72) String password){}
    public record PasswordInput(@NotBlank @Size(min=8,max=72) String password,@PositiveOrZero long version){}
    public static String landing(String role){return role.equals("KITCHEN")?"/admin/kds":"/admin/reception";}
    private void lock(){db.execute("SELECT pg_advisory_xact_lock(70619001)");}
    @Override @Transactional public void run(ApplicationArguments args){
        lock();
        if(db.queryForObject("SELECT count(*) FROM staff_users",Long.class)==0){
            if(bootstrapUsername.isBlank()||bootstrapUsername.length()>60||bootstrapPassword.isBlank()||bootstrapPassword.getBytes(StandardCharsets.UTF_8).length>72)throw new IllegalArgumentException("Invalid initial admin configuration");
            long id=db.queryForObject("INSERT INTO staff_users(username,display_name,password_hash,role) VALUES (?,?,?,'ADMIN') RETURNING id",Long.class,bootstrapUsername,"ผู้ดูแลร้าน",passwords.encode(bootstrapPassword));
            audit.record("CREATE","STAFF",id,null,audit.snapshot("STAFF",id));
        }
    }
    public List<Map<String,Object>> list(){return db.queryForList("SELECT id,username,display_name,role,active,version,created_at,updated_at FROM staff_users ORDER BY id");}
    public Map<String,Object> current(String username){return db.queryForMap("SELECT id,username,display_name,role,active,version FROM staff_users WHERE lower(username)=lower(?)",username);}
    private void password(String value){if(value==null||value.length()<8||value.getBytes(StandardCharsets.UTF_8).length>72)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และไม่เกิน 72 ไบต์");}
    private Map<String,Object> version(long id,long version){var rows=db.queryForList("SELECT id,username,role,active,version FROM staff_users WHERE id=? FOR UPDATE",id);if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"ไม่พบบัญชีพนักงาน");var row=rows.getFirst();if(((Number)row.get("version")).longValue()!=version)throw new ResponseStatusException(HttpStatus.CONFLICT,"บัญชีถูกแก้ไขแล้ว กรุณาอัปเดตข้อมูลก่อนบันทึก");return row;}
    @Transactional public Map<String,Object> save(Long id,Input input){
        lock();var before=id==null?null:audit.snapshot("STAFF",id);
        if(id==null){password(input.password);id=db.queryForObject("INSERT INTO staff_users(username,display_name,password_hash,role,active) VALUES (?,?,?,?,?) RETURNING id",Long.class,input.username.trim(),input.displayName.trim(),passwords.encode(input.password),input.role,input.active);}
        else{
            var previous=version(id,input.version);
            if(!previous.get("username").equals(input.username))throw new ResponseStatusException(HttpStatus.CONFLICT,"ไม่สามารถเปลี่ยนชื่อผู้ใช้ของบัญชีเดิมได้");
            boolean permissionsChanged=!previous.get("role").equals(input.role)||!previous.get("active").equals(input.active);
            if(permissionsChanged&&previous.get("username").equals(audit.actor()))throw new ResponseStatusException(HttpStatus.CONFLICT,"ไม่สามารถปิดหรือเปลี่ยนสิทธิ์บัญชีที่กำลังใช้งานอยู่");
            if(previous.get("role").equals("ADMIN")&&Boolean.TRUE.equals(previous.get("active"))&&(!input.active||!input.role.equals("ADMIN"))&&db.queryForObject("SELECT count(*) FROM staff_users WHERE role='ADMIN' AND active",Long.class)<=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"ต้องมีแอดมินที่ใช้งานได้อย่างน้อยหนึ่งบัญชี");
            db.update("UPDATE staff_users SET display_name=?,role=?,active=?,version=version+1,auth_version=auth_version+?,updated_at=now() WHERE id=?",input.displayName.trim(),input.role,input.active,permissionsChanged?1:0,id);
        }
        audit.record(before==null?"CREATE":"UPDATE","STAFF",id,before,audit.snapshot("STAFF",id));return Map.of("id",id);
    }
    @Transactional public void resetPassword(long id,PasswordInput input){
        lock();password(input.password);version(id,input.version);
        var before=audit.snapshot("STAFF",id);
        db.update("UPDATE staff_users SET password_hash=?,version=version+1,auth_version=auth_version+1,updated_at=now() WHERE id=?",passwords.encode(input.password),id);
        var after=audit.snapshot("STAFF",id);after.put("password_changed",true);audit.record("RESET_PASSWORD","STAFF",id,before,after);
    }
}
