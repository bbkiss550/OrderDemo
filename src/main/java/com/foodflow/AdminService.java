package com.foodflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@Service
public class AdminService {
    private final JdbcTemplate db;
    public AdminService(JdbcTemplate db) { this.db = db; }
    public record Settings(@NotBlank @Size(max=120) String name, boolean vatIncluded,
            @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=2) BigDecimal vatRate,
            @NotNull @DecimalMin("0") @DecimalMax("9999999") @Digits(integer=7,fraction=2) BigDecimal penalty,
            @Min(1) @Max(1440) int durationMinutes,
            @NotNull @DecimalMin("40") @DecimalMax("300") @Digits(integer=3,fraction=2) BigDecimal paperWidth,
            @NotNull @DecimalMin("0") @Digits(integer=3,fraction=2) BigDecimal paperMargin,
            @NotBlank @Size(max=250) String publicBaseUrl) {}
    public record PackageInput(@NotBlank @Size(max=100) String name,
            @NotNull @DecimalMin("0") @DecimalMax("9999999") @Digits(integer=7,fraction=2) BigDecimal adultPrice,
            @NotNull @DecimalMin("0") @DecimalMax("9999999") @Digits(integer=7,fraction=2) BigDecimal childPrice,
            boolean active, @PositiveOrZero long version) {}
    public record TableInput(@NotBlank @Size(max=30) String name, @Positive int capacity, boolean active) {}
    public record OpenBill(@Positive long tableId, @Min(1) @Max(1440) int durationMinutes,
            @NotNull UUID requestKey, @Positive long packageId,
            @Min(0) @Max(100) int adultQuantity, @Min(0) @Max(100) int childQuantity) {
        @com.fasterxml.jackson.annotation.JsonAnySetter
        public void unknown(String name,Object value) { throw new IllegalArgumentException("ข้อมูลเปิดบิลไม่ถูกต้อง: "+name); }
    }
    public record Checkout(boolean applyPenalty, @NotNull @Pattern(regexp="CASH|TRANSFER|CARD") String paymentMethod) {}
    public Map<String,Object> settings() { return db.queryForMap("SELECT * FROM shop_settings WHERE id=1"); }
    public List<Map<String,Object>> packages() { return db.queryForList("SELECT * FROM buffet_packages ORDER BY id"); }
    public List<Map<String,Object>> tables() {
        return db.queryForList("SELECT t.*,l.floor_id,b.id AS bill_id,b.ends_at,coalesce(b.ends_at<=now(),false) AS expired,(SELECT sum(quantity) FROM bill_lines WHERE bill_id=b.id) AS guests FROM dining_tables t LEFT JOIN table_layouts l ON l.table_id=t.id LEFT JOIN bills b ON b.table_id=t.id AND b.status='OPEN' ORDER BY t.name");
    }
    public List<Map<String,Object>> bills() {
        return db.queryForList("SELECT b.*,b.ends_at<=now() AS expired,(SELECT sum(quantity) FROM bill_lines WHERE bill_id=b.id) AS guests FROM bills b ORDER BY b.id DESC LIMIT 200");
    }
    public Map<String,Object> stats() {
        return db.queryForMap("SELECT (SELECT count(*) FROM bills WHERE status='OPEN') AS open_tables, (SELECT count(*) FROM dining_tables WHERE active=true) AS active_tables, (SELECT count(*) FROM bills WHERE (opened_at AT TIME ZONE 'Asia/Bangkok')::date=(now() AT TIME ZONE 'Asia/Bangkok')::date) AS today_bills, (SELECT coalesce(sum(l.quantity),0) FROM bill_lines l JOIN bills b ON b.id=l.bill_id WHERE b.status='OPEN') AS current_guests, (SELECT coalesce(sum(paid_total),0) FROM bills WHERE status='PAID' AND (paid_at AT TIME ZONE 'Asia/Bangkok')::date=(now() AT TIME ZONE 'Asia/Bangkok')::date) AS today_paid, (SELECT count(*) FROM bills WHERE status='OPEN' AND ends_at<=now()) AS expired_tables");
    }
    public Map<String,Object> bill(long id) {
        var rows=db.queryForList("SELECT *, ends_at<=now() AS expired FROM bills WHERE id=?",id);
        if(rows.isEmpty()) throw new ResponseStatusException(NOT_FOUND,"ไม่พบบิล");
        var b=rows.getFirst();
        b.put("lines",db.queryForList("SELECT * FROM bill_lines WHERE bill_id=? ORDER BY id",id));
        b.put("moves",db.queryForList("SELECT * FROM bill_table_moves WHERE bill_id=? ORDER BY id",id));
        b.put("qr_url",b.get("public_base_url")+"/order/"+b.get("qr_token"));
        var thaiTime=java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm",new Locale("th","TH")).withZone(ZoneId.of("Asia/Bangkok"));
        b.put("opened_text",thaiTime.format(((java.sql.Timestamp)b.get("opened_at")).toInstant()));
        b.put("ends_text",thaiTime.format(((java.sql.Timestamp)b.get("ends_at")).toInstant()));
        return b;
    }
    @Transactional public void saveSettings(Settings s) {
        if(s.paperMargin.compareTo(s.paperWidth.divide(BigDecimal.valueOf(2)))>=0) fail("ระยะขอบต้องน้อยกว่าครึ่งหนึ่งของความกว้างกระดาษ");
        try {
            var u=java.net.URI.create(s.publicBaseUrl);
            if(!Set.of("http","https").contains(u.getScheme()) || u.getHost()==null || u.getRawQuery()!=null || u.getRawFragment()!=null || u.getUserInfo()!=null || (u.getPath()!=null && !u.getPath().isEmpty() && !u.getPath().equals("/"))) fail("URL ต้องเป็น http/https และไม่มี path หรือ query");
        } catch(IllegalArgumentException e) { fail("URL ร้านไม่ถูกต้อง"); }
        db.update("UPDATE shop_settings SET name=?,vat_included=?,vat_rate=?,penalty=?,duration_minutes=?,paper_width=?,paper_margin=?,public_base_url=? WHERE id=1",
            s.name.trim(),s.vatIncluded,s.vatRate,s.penalty,s.durationMinutes,s.paperWidth,s.paperMargin,s.publicBaseUrl.replaceAll("/+$",""));
    }
    @Transactional public Map<String,Object> savePackage(Long id,PackageInput p) {
        if(id==null) id=db.queryForObject("INSERT INTO buffet_packages(name,adult_price,child_price,active) VALUES (?,?,?,?) RETURNING id",Long.class,p.name.trim(),p.adultPrice,p.childPrice,p.active);
        else {
            var rows=db.queryForList("SELECT version FROM buffet_packages WHERE id=? FOR UPDATE",id);
            if(rows.isEmpty())throw new ResponseStatusException(NOT_FOUND,"ไม่พบแพ็กเกจ");
            if(((Number)rows.getFirst().get("version")).longValue()!=p.version)fail("แพ็กเกจถูกแก้ไขแล้ว กรุณาอัปเดตข้อมูลก่อนบันทึก");
            db.update("UPDATE buffet_packages SET name=?,adult_price=?,child_price=?,active=?,version=version+1 WHERE id=?",p.name.trim(),p.adultPrice,p.childPrice,p.active,id);
        }
        return Map.of("id",id);
    }
    @Transactional public void saveTable(Long id,TableInput t) {
        if(id==null) db.update("INSERT INTO dining_tables(name,capacity,active) VALUES (?,?,?)",t.name.trim(),t.capacity,t.active);
        else {
            lockTable(id);
            if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM bills WHERE table_id=? AND status='OPEN')",Boolean.class,id))) fail("โต๊ะมีบิลเปิดอยู่ กรุณาปิดบิลก่อนแก้ไข");
            db.update("UPDATE dining_tables SET name=?,capacity=?,active=?,closure_reason=CASE WHEN ? THEN NULL ELSE closure_reason END,metadata_version=metadata_version+1 WHERE id=?",t.name.trim(),t.capacity,t.active,t.active,id);
        }
    }
    private Map<String,Object> lockTable(long id) {
        var rows=db.queryForList("SELECT * FROM dining_tables WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty()) throw new ResponseStatusException(NOT_FOUND,"ไม่พบโต๊ะ");
        return rows.getFirst();
    }
    @Transactional public Map<String,Object> open(OpenBill input) {
        var table=lockTable(input.tableId);
        var existing=db.queryForList("SELECT id,opening_table_id FROM bills WHERE request_key=?",input.requestKey);
        if(!existing.isEmpty()) {
            if(((Number)existing.getFirst().get("opening_table_id")).longValue()!=input.tableId) fail("รหัสคำขอนี้ถูกใช้กับโต๊ะอื่นแล้ว");
            return bill(((Number)existing.getFirst().get("id")).longValue());
        }
        if(!Boolean.TRUE.equals(table.get("active"))) fail("โต๊ะนี้ปิดใช้งาน");
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM bills WHERE table_id=? AND status='OPEN')",Boolean.class,input.tableId))) fail("โต๊ะนี้มีบิลเปิดอยู่แล้ว");
        int people=input.adultQuantity+input.childQuantity;
        if(people==0)fail("ระบุจำนวนผู้ใหญ่หรือเด็กอย่างน้อยหนึ่งคน");
        var plans=db.queryForList("SELECT * FROM buffet_packages WHERE id=? AND active=true FOR SHARE",input.packageId);
        if(plans.isEmpty())fail("แพ็กเกจไม่มีหรือปิดใช้งานแล้ว");
        var plan=plans.getFirst();
        BigDecimal adult=(BigDecimal)plan.get("adult_price"),child=(BigDecimal)plan.get("child_price");
        if((input.adultQuantity>0&&adult==null)||(input.childQuantity>0&&child==null))fail("แพ็กเกจยังไม่ได้กำหนดราคาสำหรับลูกค้าประเภทนี้");
        BigDecimal amount=(input.adultQuantity==0?BigDecimal.ZERO:adult.multiply(BigDecimal.valueOf(input.adultQuantity)))
                .add(input.childQuantity==0?BigDecimal.ZERO:child.multiply(BigDecimal.valueOf(input.childQuantity)));
        if(people>((Number)table.get("capacity")).intValue()) fail("จำนวนคนเกินความจุโต๊ะ");
        var s=settings(); var totals=Pricing.calculate(amount,(Boolean)s.get("vat_included"),(BigDecimal)s.get("vat_rate"));
        byte[] token=new byte[32]; new SecureRandom().nextBytes(token);
        var qr=Base64.getUrlEncoder().withoutPadding().encodeToString(token);
        long id=db.queryForObject("INSERT INTO bills(table_id,opening_table_id,table_name,qr_token,request_key,opened_at,ends_at,duration_minutes,shop_name,vat_included,vat_rate,subtotal,vat,total,penalty_rate,public_base_url,package_id,package_name) VALUES (?,?,?,?,?,now(),now()+(? * interval '1 minute'),?,?,?,?,?,?,?,?,?,?,?) RETURNING id",Long.class,
            input.tableId,input.tableId,table.get("name"),qr,input.requestKey,input.durationMinutes,input.durationMinutes,s.get("name"),s.get("vat_included"),s.get("vat_rate"),totals.subtotal(),totals.vat(),totals.total(),s.get("penalty"),s.get("public_base_url"),input.packageId,plan.get("name"));
        if(input.adultQuantity>0)db.update("INSERT INTO bill_lines(bill_id,package_id,package_name,audience,price,quantity) VALUES (?,?,?,?,?,?)",id,input.packageId,plan.get("name"),"ADULT",adult,input.adultQuantity);
        if(input.childQuantity>0)db.update("INSERT INTO bill_lines(bill_id,package_id,package_name,audience,price,quantity) VALUES (?,?,?,?,?,?)",id,input.packageId,plan.get("name"),"CHILD",child,input.childQuantity);
        return bill(id);
    }
    @Transactional public Map<String,Object> checkout(long id,Checkout c) {
        var rows=db.queryForList("SELECT * FROM bills WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty()) throw new ResponseStatusException(NOT_FOUND,"ไม่พบบิล");
        var b=rows.getFirst();
        if(!b.get("status").equals("OPEN")) fail("บิลนี้ชำระเงินแล้ว");
        var total=(BigDecimal)b.get("total");
        if(c.applyPenalty) total=total.add((BigDecimal)b.get("penalty_rate"));
        db.update("UPDATE bills SET status='PAID',penalty_applied=?,paid_total=?,paid_at=now(),payment_method=? WHERE id=?",c.applyPenalty,total,c.paymentMethod,id);
        return bill(id);
    }
    public Map<String,Object> customer(String token) {
        var rows=db.queryForList("SELECT id FROM bills WHERE qr_token=?",token);
        if(rows.isEmpty()) throw new ResponseStatusException(NOT_FOUND,"QR ไม่ถูกต้อง");
        return bill(((Number)rows.getFirst().get("id")).longValue());
    }
    private static void fail(String message) { throw new ResponseStatusException(CONFLICT,message); }
}
