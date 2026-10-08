package com.foodflow;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@Service
public class FloorPlanService {
    private final JdbcTemplate db;
    private final AdminService admin;
    public FloorPlanService(JdbcTemplate db, AdminService admin) { this.db=db; this.admin=admin; }

    public record FloorInput(@NotBlank @Size(max=80) String name,
            @Min(1) @Max(100) int rows, @Min(1) @Max(100) int columns, @PositiveOrZero long version) {}
    public record Cell(@Min(0) int row, @Min(0) int column) {}
    public record Placement(@Positive Long tableId, @PositiveOrZero long tableVersion, @NotBlank @Size(max=30) String name,
            @Positive int capacity, @NotEmpty @Size(max=10000) List<@NotNull @Valid Cell> cells) {}
    public record LayoutInput(@PositiveOrZero long version,
            @NotNull @Size(max=10000) List<@NotNull @Valid Placement> tables) {}
    public record VersionInput(@PositiveOrZero long version) {}
    public record Availability(boolean active, @Size(max=250) String reason) {}
    public record MoveInput(@Positive long fromTableId, @Positive long toTableId, @NotNull UUID requestKey) {}

    public List<Map<String,Object>> floors() {
        return db.queryForList("SELECT f.*, (SELECT count(*) FROM table_layouts WHERE floor_id=f.id) AS table_count FROM restaurant_floors f ORDER BY f.id");
    }
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Map<String,Object> layout(long id) {
        var f=findFloor(id,false);
        var tables=db.queryForList("SELECT t.*,b.id AS bill_id,b.ends_at,coalesce(b.ends_at<=now(),false) AS expired,(SELECT sum(quantity) FROM bill_lines WHERE bill_id=b.id) AS guests FROM table_layouts l JOIN dining_tables t ON t.id=l.table_id LEFT JOIN bills b ON b.table_id=t.id AND b.status='OPEN' WHERE l.floor_id=? ORDER BY t.name",id);
        var allCells=db.queryForList("SELECT table_id,row_index AS row,column_index AS column FROM table_cells WHERE floor_id=? ORDER BY row_index,column_index",id);
        for(var t:tables) t.put("cells",allCells.stream().filter(c->c.get("table_id").equals(t.get("id"))).map(c->Map.of("row",c.get("row"),"column",c.get("column"))).toList());
        return Map.of("floor",f,"tables",tables);
    }
    private Map<String,Object> findFloor(long id,boolean lock) {
        var rows=db.queryForList("SELECT * FROM restaurant_floors WHERE id=?"+(lock?" FOR UPDATE":""),id);
        if(rows.isEmpty()) throw new ResponseStatusException(NOT_FOUND,"ไม่พบชั้น");
        return rows.getFirst();
    }
    private void checkVersion(Map<String,Object> f,long expected) {
        if(((Number)f.get("version")).longValue()!=expected) fail("ผังนี้ถูกแก้ไขแล้ว กรุณาโหลดผังล่าสุดก่อนบันทึกอีกครั้ง");
    }
    public Map<String,Object> createFloor(FloorInput input) {
        long id=db.queryForObject("INSERT INTO restaurant_floors(name,grid_rows,grid_columns) VALUES (?,?,?) RETURNING id",Long.class,input.name.trim(),input.rows,input.columns);
        return findFloor(id,false);
    }
    @Transactional public Map<String,Object> updateFloor(long id,FloorInput input) {
        var f=findFloor(id,true); checkVersion(f,input.version);
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM table_cells WHERE floor_id=? AND (row_index>=? OR column_index>=?))",Boolean.class,id,input.rows,input.columns))) fail("ขนาดใหม่จะตัดพื้นที่โต๊ะ กรุณาจัดตำแหน่งโต๊ะให้พอดีก่อนลดขนาดผัง");
        db.update("UPDATE restaurant_floors SET name=?,grid_rows=?,grid_columns=?,version=version+1 WHERE id=?",input.name.trim(),input.rows,input.columns,id);
        return findFloor(id,false);
    }
    @Transactional public void deleteFloor(long id,long version) {
        var f=findFloor(id,true); checkVersion(f,version);
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM table_layouts WHERE floor_id=?)",Boolean.class,id))) fail("นำโต๊ะออกจากผังให้ครบก่อนลบชั้น");
        db.update("DELETE FROM restaurant_floors WHERE id=?",id);
    }
    @Transactional public Map<String,Object> saveLayout(long id,LayoutInput input) {
        var f=findFloor(id,true); checkVersion(f,input.version);
        int rows=((Number)f.get("grid_rows")).intValue(),columns=((Number)f.get("grid_columns")).intValue();
        var cells=new HashSet<Cell>(); var ids=new HashSet<Long>(); var names=new HashSet<String>();
        for(var t:input.tables) {
            if(!names.add(t.name.trim())) fail("ชื่อโต๊ะซ้ำในผัง");
            if(t.tableId!=null&&!ids.add(t.tableId)) fail("โต๊ะเดียวกันวางได้เพียงครั้งเดียว");
            for(var c:t.cells) {
                if(c.row>=rows||c.column>=columns) fail("พื้นที่โต๊ะอยู่นอกขอบเขตผัง");
                if(!cells.add(c)) fail("พื้นที่โต๊ะทับกันหรือเลือกช่องซ้ำ");
            }
        }
        // Lock all affected tables in the same order used by bill transfers.
        var affected=new TreeSet<Long>(ids);
        affected.addAll(db.queryForList("SELECT table_id FROM table_layouts WHERE floor_id=?",Long.class,id));
        var locked=new HashMap<Long,Map<String,Object>>();
        for(long tableId:affected) locked.put(tableId,lockTable(tableId));
        for(long tableId:affected) {
            if(!ids.contains(tableId)&&hasOpenBill(tableId)) fail("โต๊ะที่มีบิลเปิดอยู่ต้องคงไว้ในผัง กรุณาย้ายหรือปิดบิลก่อนนำออก");
        }
        for(var t:input.tables) if(t.tableId!=null) {
            var placements=db.queryForList("SELECT floor_id FROM table_layouts WHERE table_id=?",t.tableId);
            if(!placements.isEmpty()&&((Number)placements.getFirst().get("floor_id")).longValue()!=id) fail("โต๊ะนี้อยู่บนชั้นอื่น กรุณานำออกจากผังเดิมก่อน");
            var original=locked.get(t.tableId);
            if(((Number)original.get("metadata_version")).longValue()!=t.tableVersion) fail("ข้อมูลโต๊ะถูกแก้ไขแล้ว กรุณาโหลดผังล่าสุดก่อนบันทึก");
            if(hasOpenBill(t.tableId)&&(!original.get("name").equals(t.name.trim())||((Number)original.get("capacity")).intValue()!=t.capacity)) fail("โต๊ะที่มีบิลเปิดอยู่เปลี่ยนได้เฉพาะพื้นที่ในผัง กรุณาย้ายหรือปิดบิลก่อนแก้ชื่อ/ที่นั่ง");
        }
        // Release placements only. Removing a table from a plan never deletes the actual table or bill.
        db.update("DELETE FROM table_layouts WHERE floor_id=?",id);
        for(var t:input.tables) {
            long tableId;
            if(t.tableId==null) tableId=db.queryForObject("INSERT INTO dining_tables(name,capacity,active) VALUES (?,?,true) RETURNING id",Long.class,t.name.trim(),t.capacity);
            else {tableId=t.tableId;db.update("UPDATE dining_tables SET name=?,capacity=?,metadata_version=metadata_version+1 WHERE id=?",t.name.trim(),t.capacity,tableId);}
            db.update("INSERT INTO table_layouts(table_id,floor_id) VALUES (?,?)",tableId,id);
            for(var c:t.cells)db.update("INSERT INTO table_cells(floor_id,row_index,column_index,table_id) VALUES (?,?,?,?)",id,c.row,c.column,tableId);
        }
        db.update("UPDATE restaurant_floors SET version=version+1 WHERE id=?",id);
        return layout(id);
    }
    @Transactional public void availability(long id,Availability input) {
        lockTable(id);
        if(hasOpenBill(id)) fail("โต๊ะยังมีบิลเปิดอยู่ กรุณาย้ายลูกค้าหรือปิดบิลก่อนปิดปรับปรุง");
        String reason=input.active?null:(input.reason==null||input.reason.isBlank()?"ปิดปรับปรุงชั่วคราว":input.reason.trim());
        db.update("UPDATE dining_tables SET active=?,closure_reason=? WHERE id=?",input.active,reason,id);
    }
    private Map<String,Object> lockTable(long id) {
        var rows=db.queryForList("SELECT * FROM dining_tables WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty()) throw new ResponseStatusException(NOT_FOUND,"ไม่พบโต๊ะ");
        return rows.getFirst();
    }
    private boolean hasOpenBill(long id) { return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM bills WHERE table_id=? AND status='OPEN')",Boolean.class,id)); }
    private Map<String,Object> replay(long billId,MoveInput input) {
        var previous=db.queryForList("SELECT * FROM bill_table_moves WHERE request_key=?",input.requestKey);
        if(previous.isEmpty()) return null;
        var move=previous.getFirst();
        if(((Number)move.get("bill_id")).longValue()!=billId||((Number)move.get("from_table_id")).longValue()!=input.fromTableId||((Number)move.get("to_table_id")).longValue()!=input.toTableId) fail("รหัสคำขอย้ายนี้ถูกใช้กับรายการอื่นแล้ว");
        return admin.bill(billId);
    }
    @Transactional public Map<String,Object> moveBill(long id,MoveInput input,String actor) {
        var previous=replay(id,input); if(previous!=null)return previous;
        if(input.fromTableId==input.toTableId) fail("กรุณาเลือกโต๊ะปลายทางคนละโต๊ะ");
        var tables=new HashMap<Long,Map<String,Object>>();
        for(long tableId:new TreeSet<>(List.of(input.fromTableId,input.toTableId)))tables.put(tableId,lockTable(tableId));
        previous=replay(id,input); if(previous!=null)return previous;
        var bills=db.queryForList("SELECT * FROM bills WHERE id=? FOR UPDATE",id);
        if(bills.isEmpty())throw new ResponseStatusException(NOT_FOUND,"ไม่พบบิล");
        var bill=bills.getFirst();
        if(!bill.get("status").equals("OPEN")) fail("บิลชำระแล้ว ไม่สามารถย้ายโต๊ะได้");
        if(((Number)bill.get("table_id")).longValue()!=input.fromTableId) fail("บิลถูกย้ายไปแล้ว กรุณาเปิดข้อมูลบิลล่าสุด");
        var destination=tables.get(input.toTableId);
        if(!Boolean.TRUE.equals(destination.get("active"))) fail("โต๊ะปลายทางปิดรับอยู่");
        if(hasOpenBill(input.toTableId)) fail("โต๊ะปลายทางมีบิลอยู่แล้ว ไม่สามารถรวมบิลได้");
        int guests=db.queryForObject("SELECT coalesce(sum(quantity),0)::integer FROM bill_lines WHERE bill_id=?",Integer.class,id);
        if(guests>((Number)destination.get("capacity")).intValue()) fail("โต๊ะปลายทางมีที่นั่งไม่เพียงพอ");
        db.update("INSERT INTO bill_table_moves(bill_id,from_table_id,to_table_id,from_table_name,to_table_name,moved_by,request_key) VALUES (?,?,?,?,?,?,?)",id,input.fromTableId,input.toTableId,bill.get("table_name"),destination.get("name"),actor,input.requestKey);
        db.update("UPDATE bills SET table_id=?,table_name=? WHERE id=?",input.toTableId,destination.get("name"),id);
        return admin.bill(id);
    }
    private static void fail(String message) { throw new ResponseStatusException(CONFLICT,message); }
}
