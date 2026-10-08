package com.foodflow;

import jakarta.validation.constraints.*;
import java.io.ByteArrayInputStream;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@Service
public class MenuService {
    private final JdbcTemplate db;
    public MenuService(JdbcTemplate db) { this.db=db; }
    public record CategoryInput(@NotBlank @Size(max=80) String name, @PositiveOrZero int sortOrder,
            boolean active, @PositiveOrZero long version) {}
    public record MenuInput(@NotBlank @Size(max=120) String name, @Positive long categoryId,
            @NotNull @Size(max=250) String description, @NotBlank @Size(max=32) String emoji,
            @PositiveOrZero int sortOrder, boolean active, @PositiveOrZero long version,
            @NotNull @Size(max=1000) List<@NotNull @Positive Long> packageIds,
            @Size(max=2800000) String imageData, boolean removeImage) {}
    public record StatusInput(boolean active,@PositiveOrZero long version) {}
    public record PackageAccess(boolean enabled,@PositiveOrZero long version) {}
    public record Image(byte[] bytes,String type) {}

    public List<Map<String,Object>> categories() {
        return db.queryForList("SELECT c.*,(SELECT count(*) FROM food_menus WHERE category_id=c.id) AS menu_count FROM food_categories c ORDER BY c.sort_order,c.id");
    }
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public List<Map<String,Object>> menus() {
        var menus=db.queryForList("SELECT m.id,m.category_id,m.name,m.description,m.emoji,m.sort_order,m.active,m.version,m.image_bytes IS NOT NULL AS has_image,c.name AS category_name,c.active AS category_active,(m.active AND c.active AND EXISTS(SELECT 1 FROM menu_packages mp JOIN buffet_packages p ON p.id=mp.package_id WHERE mp.menu_id=m.id AND p.active)) AS available FROM food_menus m JOIN food_categories c ON c.id=m.category_id ORDER BY c.sort_order,m.sort_order,m.id");
        var links=db.queryForList("SELECT menu_id,package_id FROM menu_packages ORDER BY package_id");
        for(var m:menus)m.put("package_ids",links.stream().filter(l->l.get("menu_id").equals(m.get("id"))).map(l->l.get("package_id")).toList());
        return menus;
    }
    private void version(String table,long id,long expected) {
        var rows=db.queryForList("SELECT version FROM "+table+" WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty())throw new ResponseStatusException(NOT_FOUND,"ไม่พบรายการ");
        if(((Number)rows.getFirst().get("version")).longValue()!=expected)throw new ResponseStatusException(CONFLICT,"รายการนี้ถูกแก้ไขแล้ว กรุณาอัปเดตข้อมูลก่อนบันทึกอีกครั้ง");
    }
    @Transactional public Map<String,Object> saveCategory(Long id,CategoryInput input) {
        if(id==null)id=db.queryForObject("INSERT INTO food_categories(name,sort_order,active) VALUES (?,?,?) RETURNING id",Long.class,input.name.trim(),input.sortOrder,input.active);
        else {version("food_categories",id,input.version);db.update("UPDATE food_categories SET name=?,sort_order=?,active=?,version=version+1 WHERE id=?",input.name.trim(),input.sortOrder,input.active,id);}
        return Map.of("id",id);
    }
    @Transactional public Map<String,Object> saveMenu(Long id,MenuInput input) {
        var packages=new TreeSet<>(input.packageIds);
        if(packages.size()!=input.packageIds.size())throw new ResponseStatusException(CONFLICT,"เลือกแพ็กเกจซ้ำ");
        if(db.queryForList("SELECT id FROM food_categories WHERE id=? FOR SHARE",input.categoryId).isEmpty())throw new ResponseStatusException(CONFLICT,"ไม่พบหมวดหมู่ที่เลือก");
        for(long packageId:packages)if(db.queryForList("SELECT id FROM buffet_packages WHERE id=? FOR SHARE",packageId).isEmpty())throw new ResponseStatusException(CONFLICT,"ไม่พบแพ็กเกจที่เลือก");
        Image image=decodeImage(input.imageData);
        if(image!=null&&input.removeImage)throw new ResponseStatusException(BAD_REQUEST,"เลือกอัปโหลดรูปหรือลบรูปอย่างใดอย่างหนึ่ง");
        if(id==null)id=db.queryForObject("INSERT INTO food_menus(category_id,name,description,emoji,sort_order,active) VALUES (?,?,?,?,?,?) RETURNING id",Long.class,input.categoryId,input.name.trim(),input.description.trim(),input.emoji.trim(),input.sortOrder,input.active);
        else {version("food_menus",id,input.version);db.update("UPDATE food_menus SET category_id=?,name=?,description=?,emoji=?,sort_order=?,active=?,version=version+1 WHERE id=?",input.categoryId,input.name.trim(),input.description.trim(),input.emoji.trim(),input.sortOrder,input.active,id);}
        if(image!=null)db.update("UPDATE food_menus SET image_bytes=?,image_type=? WHERE id=?",image.bytes,image.type,id);
        else if(input.removeImage)db.update("UPDATE food_menus SET image_bytes=NULL,image_type=NULL WHERE id=?",id);
        db.update("DELETE FROM menu_packages WHERE menu_id=?",id);
        for(long packageId:packages)db.update("INSERT INTO menu_packages(menu_id,package_id) VALUES (?,?)",id,packageId);
        return Map.of("id",id);
    }
    @Transactional public void status(long id,StatusInput input) {
        version("food_menus",id,input.version);
        db.update("UPDATE food_menus SET active=?,version=version+1 WHERE id=?",input.active,id);
    }
    @Transactional public void packageAccess(long id,long packageId,PackageAccess input) {
        if(db.queryForList("SELECT id FROM buffet_packages WHERE id=? FOR SHARE",packageId).isEmpty())throw new ResponseStatusException(NOT_FOUND,"ไม่พบแพ็กเกจ");
        version("food_menus",id,input.version);
        if(input.enabled)db.update("INSERT INTO menu_packages(menu_id,package_id) VALUES (?,?) ON CONFLICT DO NOTHING",id,packageId);
        else db.update("DELETE FROM menu_packages WHERE menu_id=? AND package_id=?",id,packageId);
        db.update("UPDATE food_menus SET version=version+1 WHERE id=?",id);
    }
    public Image image(long id) {
        var rows=db.queryForList("SELECT image_bytes,image_type FROM food_menus WHERE id=? AND image_bytes IS NOT NULL",id);
        if(rows.isEmpty())throw new ResponseStatusException(NOT_FOUND,"ไม่พบรูปอาหาร");
        return new Image((byte[])rows.getFirst().get("image_bytes"),(String)rows.getFirst().get("image_type"));
    }
    private Image decodeImage(String data) {
        if(data==null||data.isBlank())return null;
        try {
            int comma=data.indexOf(',');
            if(comma<0||!(data.startsWith("data:image/png;base64,")||data.startsWith("data:image/jpeg;base64,")))throw new IllegalArgumentException();
            byte[] bytes=Base64.getDecoder().decode(data.substring(comma+1));
            if(bytes.length==0||bytes.length>2097152)throw new IllegalArgumentException();
            try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new IllegalArgumentException();
                var reader=readers.next();
                try {reader.setInput(stream,true,true);String format=reader.getFormatName().toLowerCase(Locale.ROOT);int width=reader.getWidth(0),height=reader.getHeight(0);
                    if(!(format.equals("png")||format.equals("jpeg"))||width<1||height<1||width>4096||height>4096||(long)width*height>16000000)throw new IllegalArgumentException();
                    reader.read(0);return new Image(bytes,format.equals("png")?"image/png":"image/jpeg");
                } finally {reader.dispose();}
            }
        }catch(Exception e){throw new ResponseStatusException(BAD_REQUEST,"รูปต้องเป็น JPG หรือ PNG ไม่เกิน 2 MB และขนาดไม่เกิน 4096 × 4096 พิกเซล");}
    }
}
