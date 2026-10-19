package com.foodflow;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class HistoryService {
    static final String BILL_SELECT="SELECT b.*,coalesce((SELECT sum(quantity) FROM bill_lines WHERE bill_id=b.id),0) AS guests,b.ends_at<=now() AS expired FROM bills b";
    private final JdbcTemplate db;
    public HistoryService(JdbcTemplate db){this.db=db;}
    private void dates(StringBuilder where,List<Object> args,String field,LocalDate from,LocalDate to){
        if((from!=null&&from.getYear()<1900)||(to!=null&&to.getYear()>2200)||(from!=null&&to!=null&&from.isAfter(to))||(from!=null&&from.getYear()>2200)||(to!=null&&to.getYear()<1900))throw new ResponseStatusException(BAD_REQUEST,"ช่วงวันที่ไม่ถูกต้อง");
        var zone=ZoneId.of("Asia/Bangkok");
        if(from!=null){where.append(" AND ").append(field).append(">=?");args.add(Timestamp.from(from.atStartOfDay(zone).toInstant()));}
        if(to!=null){where.append(" AND ").append(field).append("<?");args.add(Timestamp.from(to.plusDays(1).atStartOfDay(zone).toInstant()));}
    }
    private int page(long total,int requested,int size){if(requested<0||size<1||size>100)throw new ResponseStatusException(BAD_REQUEST,"เลขหน้าหรือจำนวนรายการไม่ถูกต้อง");return (int)Math.min(requested,Math.max(0,(total-1)/size));}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> bills(LocalDate from,LocalDate to,String dateType,String status,String q,int requested,int size){
        if(!Set.of("opened","paid").contains(dateType)||!Set.of("ALL","OPEN","PAID").contains(status)||q.length()>100)throw new ResponseStatusException(BAD_REQUEST,"ตัวกรองบิลไม่ถูกต้อง");
        var where=new StringBuilder(" WHERE 1=1");var args=new ArrayList<Object>();
        if(dateType.equals("paid"))where.append(" AND b.paid_at IS NOT NULL");
        dates(where,args,dateType.equals("paid")?"b.paid_at":"b.opened_at",from,to);
        if(!status.equals("ALL")){where.append(" AND b.status=?");args.add(status);}
        if(!q.isBlank()){String pattern="%"+q.trim().replace("!","!!").replace("%","!%").replace("_","!_")+"%";where.append(" AND (cast(b.id AS text) ILIKE ? ESCAPE '!' OR b.table_name ILIKE ? ESCAPE '!')");args.add(pattern.startsWith("%#")?pattern.replaceFirst("%#","%"):pattern);args.add(pattern);}
        long total=db.queryForObject("SELECT count(*) FROM bills b"+where,Long.class,args.toArray());int page=page(total,requested,size);
        args.add(size);args.add((long)page*size);
        return Map.of("items",db.queryForList(BILL_SELECT+where+" ORDER BY b.id DESC LIMIT ? OFFSET ?",args.toArray()),"total",total,"page",page,"size",size);
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> audit(LocalDate from,LocalDate to,String type,String q,int requested,int size){
        if(!Set.of("ALL","SETTINGS","PACKAGE","MENU","CATEGORY","STAFF","BILL","TABLE","ORDER").contains(type)||q.length()>100)throw new ResponseStatusException(BAD_REQUEST,"ตัวกรองประวัติไม่ถูกต้อง");
        var where=new StringBuilder(" WHERE 1=1");var args=new ArrayList<Object>();dates(where,args,"occurred_at",from,to);
        if(!type.equals("ALL")){where.append(" AND entity_type=?");args.add(type);}
        if(!q.isBlank()){where.append(" AND actor ILIKE ? ESCAPE '!'");args.add("%"+q.trim().replace("!","!!").replace("%","!%").replace("_","!_")+"%");}
        long total=db.queryForObject("SELECT count(*) FROM audit_events"+where,Long.class,args.toArray());int page=page(total,requested,size);args.add(size);args.add((long)page*size);
        return Map.of("items",db.queryForList("SELECT id,occurred_at,actor,action,entity_type,entity_id,before_data::text AS before_data,after_data::text AS after_data FROM audit_events"+where+" ORDER BY id DESC LIMIT ? OFFSET ?",args.toArray()),"total",total,"page",page,"size",size);
    }
}
