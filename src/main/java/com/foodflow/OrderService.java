package com.foodflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@Service
public class OrderService {
    private final JdbcTemplate db;
    private final AuditService audit;
    public OrderService(JdbcTemplate db,AuditService audit){this.db=db;this.audit=audit;}
    public record Item(@Positive long menuId,@Min(1) @Max(99) int quantity) {}
    public record Submit(@NotNull UUID requestKey,@NotEmpty @Size(max=50) List<@NotNull @Valid Item> items) {}
    public record Status(@NotNull @Pattern(regexp="COOKING|READY|SERVED") String status,
                         @PositiveOrZero long version,@Positive Long itemId) {}
    static final String ROUND_SELECT="""
        SELECT r.id,r.bill_id,r.round_no,r.table_name_at_order,r.status,r.version,r.created_at,r.updated_at,
               b.table_name,b.status AS bill_status,b.package_name,
               (SELECT sum(quantity) FROM order_items WHERE round_id=r.id) AS quantity
        FROM order_rounds r JOIN bills b ON b.id=r.bill_id
        """;
    private Map<String,Object> tokenBill(String token,boolean lock){
        if(token==null||!token.matches("[A-Za-z0-9_-]{43}"))throw new ResponseStatusException(NOT_FOUND,"QR ไม่ถูกต้อง");
        var rows=db.queryForList("SELECT * FROM bills WHERE qr_token=?"+(lock?" FOR UPDATE":""),token);
        if(rows.isEmpty())throw new ResponseStatusException(NOT_FOUND,"QR ไม่ถูกต้อง");return rows.getFirst();
    }
    private boolean canOrder(Map<String,Object> bill){
        return "OPEN".equals(bill.get("status"))&&bill.get("package_id")!=null&&
            Boolean.TRUE.equals(db.queryForObject("SELECT ?::timestamptz>clock_timestamp()",Boolean.class,bill.get("ends_at")));
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> customer(String token,int requested){
        if(requested<0)throw new ResponseStatusException(BAD_REQUEST,"เลขหน้าไม่ถูกต้อง");
        var bill=tokenBill(token,false);long id=((Number)bill.get("id")).longValue();
        var visible=new LinkedHashMap<String,Object>();
        for(String key:List.of("id","shop_name","table_name","package_name","status","opened_at","ends_at","duration_minutes"))visible.put(key,bill.get(key));
        visible.put("can_order",canOrder(bill));
        visible.put("guests",db.queryForObject("SELECT coalesce(sum(quantity),0) FROM bill_lines WHERE bill_id=?",Long.class,id));
        var menus=Boolean.TRUE.equals(visible.get("can_order"))?db.queryForList("""
            SELECT m.id,m.name,m.description,m.emoji,m.category_id,c.name AS category_name,
                   m.image_bytes IS NOT NULL AS has_image
            FROM food_menus m JOIN food_categories c ON c.id=m.category_id
            JOIN menu_packages mp ON mp.menu_id=m.id
            WHERE mp.package_id=? AND c.active AND m.active
            ORDER BY c.sort_order,c.id,m.sort_order,m.id
            """,bill.get("package_id")):List.of();
        long total=db.queryForObject("SELECT count(*) FROM order_rounds WHERE bill_id=?",Long.class,id);
        int page=(int)Math.min(requested,Math.max(0,(total-1)/20));
        var rounds=db.queryForList(ROUND_SELECT+" WHERE r.bill_id=? ORDER BY r.id DESC LIMIT 20 OFFSET ?",id,(long)page*20);
        attachItems(rounds);
        return Map.of("bill",visible,"menus",menus,"rounds",rounds,"total",total,"page",page,"size",20,"server_time",Instant.now());
    }
    static String fingerprint(List<Item> items){
        if(items==null||items.isEmpty()||items.size()>50)throw new ResponseStatusException(BAD_REQUEST,"เลือกอาหาร 1–50 รายการต่อรอบ");
        var selected=new TreeMap<Long,Integer>();
        for(var item:items){
            if(item==null||item.menuId<=0||item.quantity<1||item.quantity>99||selected.put(item.menuId,item.quantity)!=null)
                throw new ResponseStatusException(BAD_REQUEST,"อาหารซ้ำหรือจำนวนไม่ถูกต้อง (1–99 ต่อรายการ)");
        }
        String text=selected.entrySet().stream().map(e->e.getKey()+":"+e.getValue()).collect(Collectors.joining(","));
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
    @Transactional
    public Map<String,Object> submit(String token,Submit input){
        String hash=fingerprint(input.items);var bill=tokenBill(token,true);long billId=((Number)bill.get("id")).longValue();
        // A replay remains successful after expiry/checkout: it acknowledges an already accepted round.
        var replay=db.queryForList("SELECT id,request_hash FROM order_rounds WHERE bill_id=? AND request_key=?",billId,input.requestKey);
        if(!replay.isEmpty()){
            if(!hash.equals(replay.getFirst().get("request_hash")))throw new ResponseStatusException(CONFLICT,"รหัสการส่งนี้ถูกใช้กับรายการอาหารอื่นแล้ว");
            return round(((Number)replay.getFirst().get("id")).longValue());
        }
        if(!canOrder(bill))throw new ResponseStatusException(CONFLICT,"บิลสิ้นสุดหรือหมดเวลาสั่งอาหารแล้ว");
        var sorted=input.items.stream().sorted(Comparator.comparingLong(Item::menuId)).toList();
        String placeholders=String.join(",",Collections.nCopies(sorted.size(),"?"));
        var args=new ArrayList<Object>();args.add(bill.get("package_id"));sorted.forEach(item->args.add(item.menuId));
        var menus=db.queryForList("""
            SELECT m.id,m.name,m.emoji,c.name AS category_name
            FROM food_menus m JOIN food_categories c ON c.id=m.category_id
            JOIN menu_packages mp ON mp.menu_id=m.id
            WHERE mp.package_id=? AND m.active AND c.active AND m.id IN (
            """+placeholders+") ORDER BY c.id,m.id FOR SHARE OF c,m,mp",args.toArray());
        if(menus.size()!=sorted.size())throw new ResponseStatusException(CONFLICT,"อาหารบางรายการปิดขายหรือไม่อยู่ในแพ็กเกจ กรุณาตรวจตะกร้าอีกครั้ง");
        // Check wall-clock time after acquiring catalog locks, rather than transaction-start now().
        if(!canOrder(bill))throw new ResponseStatusException(CONFLICT,"หมดเวลาสั่งอาหารแล้ว");
        int number=db.queryForObject("SELECT coalesce(max(round_no),0)+1 FROM order_rounds WHERE bill_id=?",Integer.class,billId);
        long id=db.queryForObject("INSERT INTO order_rounds(bill_id,round_no,request_key,request_hash,table_name_at_order) VALUES (?,?,?,?,?) RETURNING id",Long.class,billId,number,input.requestKey,hash,bill.get("table_name"));
        var quantities=new HashMap<Long,Integer>();sorted.forEach(item->quantities.put(item.menuId,item.quantity));
        for(var menu:menus)db.update("INSERT INTO order_items(round_id,menu_id,menu_name,category_name,emoji,quantity) VALUES (?,?,?,?,?,?)",id,menu.get("id"),menu.get("name"),menu.get("category_name"),menu.get("emoji"),quantities.get(((Number)menu.get("id")).longValue()));
        audit.recordAs("ลูกค้า QR","ORDER_CREATE","ORDER",id,null,Map.of("bill_id",billId,"round_no",number,"status","PENDING"));
        return round(id);
    }
    private void attachItems(List<Map<String,Object>> rounds){
        if(rounds.isEmpty())return;
        String placeholders=String.join(",",Collections.nCopies(rounds.size(),"?"));
        var items=db.queryForList("SELECT * FROM order_items WHERE round_id IN ("+placeholders+") ORDER BY id",rounds.stream().map(r->r.get("id")).toArray());
        for(var round:rounds)round.put("items",items.stream().filter(i->i.get("round_id").equals(round.get("id"))).toList());
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> round(long id){
        var rows=db.queryForList(ROUND_SELECT+" WHERE r.id=?",id);
        if(rows.isEmpty())throw new ResponseStatusException(NOT_FOUND,"ไม่พบออเดอร์");attachItems(rows);return rows.getFirst();
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> list(String status,String q,Long billId,int requested,int size){
        if(!Set.of("ACTIVE","ALL","PENDING","COOKING","READY","SERVED").contains(status)||q.length()>100||requested<0||!Set.of(20,50,100).contains(size))
            throw new ResponseStatusException(BAD_REQUEST,"ตัวกรองออเดอร์ไม่ถูกต้อง");
        var args=new ArrayList<Object>();String where=" WHERE true";
        if(status.equals("ACTIVE"))where+=" AND r.status<>'SERVED'";
        else if(!status.equals("ALL")){where+=" AND r.status=?";args.add(status);}
        if(billId!=null){where+=" AND r.bill_id=?";args.add(billId);}
        if(!q.isBlank()){where+=" AND (b.table_name ILIKE ? ESCAPE '!' OR r.id::text=? OR r.bill_id::text=?)";args.add("%"+q.trim().replace("!","!!").replace("%","!%").replace("_","!_")+"%");args.add(q.trim().replaceFirst("^#",""));args.add(q.trim().replaceFirst("^#",""));}
        long total=db.queryForObject("SELECT count(*) FROM order_rounds r JOIN bills b ON b.id=r.bill_id"+where,Long.class,args.toArray());
        int page=(int)Math.min(requested,Math.max(0,(total-1)/size));args.add(size);args.add((long)page*size);
        String sort=status.equals("SERVED")||status.equals("ALL")?" ORDER BY r.id DESC":" ORDER BY r.created_at,r.id";
        var rounds=db.queryForList(ROUND_SELECT+where+sort+" LIMIT ? OFFSET ?",args.toArray());attachItems(rounds);
        var counts=new LinkedHashMap<String,Object>();
        for(String key:List.of("PENDING","COOKING","READY","SERVED"))counts.put(key,0L);
        for(var count:db.queryForList("SELECT status,count(*) AS count FROM order_rounds WHERE status<>'SERVED' OR updated_at>=(date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok') GROUP BY status"))counts.put((String)count.get("status"),count.get("count"));
        return Map.of("items",rounds,"total",total,"page",page,"size",size,"counts",counts,"server_time",Instant.now());
    }
    static String next(String status){return switch(status){case "PENDING"->"COOKING";case "COOKING"->"READY";case "READY"->"SERVED";default->"";};}
    @Transactional
    public Map<String,Object> status(long id,Status input){
        var auth=SecurityContextHolder.getContext().getAuthentication();
        boolean servingOnly=auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_CASHIER"));
        if(servingOnly&&!"SERVED".equals(input.status))throw new ResponseStatusException(FORBIDDEN,"แคชเชียร์ยืนยันเสิร์ฟอาหารที่พร้อมแล้วได้เท่านั้น");
        var locked=db.queryForList("SELECT * FROM order_rounds WHERE id=? FOR UPDATE",id);
        if(locked.isEmpty())throw new ResponseStatusException(NOT_FOUND,"ไม่พบออเดอร์");
        var current=locked.getFirst();
        if(((Number)current.get("version")).longValue()!=input.version)throw new ResponseStatusException(CONFLICT,"ออเดอร์ถูกอัปเดตจากจออื่นแล้ว กรุณาใช้ข้อมูลล่าสุด");
        var before=round(id);String source=(String)current.get("status");
        if(input.itemId!=null){
            var items=db.queryForList("SELECT status FROM order_items WHERE id=? AND round_id=?",input.itemId,id);
            if(items.isEmpty())throw new ResponseStatusException(NOT_FOUND,"ไม่พบอาหารในออเดอร์นี้");source=(String)items.getFirst().get("status");
        }
        if(!next(source).equals(input.status))throw new ResponseStatusException(CONFLICT,"เปลี่ยนสถานะได้ตามลำดับ รับออเดอร์ → กำลังทำ → พร้อมเสิร์ฟ → เสิร์ฟแล้ว");
        String timestamp=switch(input.status){case "COOKING"->"started_at";case "READY"->"ready_at";case "SERVED"->"served_at";default->throw new ResponseStatusException(BAD_REQUEST,"สถานะไม่ถูกต้อง");};
        if(input.itemId==null)db.update("UPDATE order_items SET status=?,"+timestamp+"=clock_timestamp() WHERE round_id=? AND status=?",input.status,id,source);
        else db.update("UPDATE order_items SET status=?,"+timestamp+"=clock_timestamp() WHERE round_id=? AND id=?",input.status,id,input.itemId);
        db.update("""
            UPDATE order_rounds SET status=(SELECT CASE min(CASE status WHEN 'PENDING' THEN 0 WHEN 'COOKING' THEN 1 WHEN 'READY' THEN 2 ELSE 3 END)
                WHEN 0 THEN 'PENDING' WHEN 1 THEN 'COOKING' WHEN 2 THEN 'READY' ELSE 'SERVED' END FROM order_items WHERE round_id=?),
                version=version+1,updated_at=clock_timestamp() WHERE id=?
            """,id,id);
        var after=round(id);audit.record("ORDER_STATUS","ORDER",id,before,after);return after;
    }
}
