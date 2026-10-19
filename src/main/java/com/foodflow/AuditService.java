package com.foodflow;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public AuditService(JdbcTemplate db,ObjectMapper json){this.db=db;this.json=json;}
    public String actor(){var a=SecurityContextHolder.getContext().getAuthentication();return a==null?"system":a.getName();}
    public Map<String,Object> snapshot(String type,long id){
        String sql=switch(type){
            case "SETTINGS" -> "SELECT * FROM shop_settings WHERE id=?";
            case "PACKAGE" -> "SELECT * FROM buffet_packages WHERE id=?";
            case "CATEGORY" -> "SELECT * FROM food_categories WHERE id=?";
            case "MENU" -> "SELECT id,category_id,name,description,emoji,sort_order,active,image_bytes IS NOT NULL AS has_image FROM food_menus WHERE id=?";
            case "STAFF" -> "SELECT id,username,display_name,role,active FROM staff_users WHERE id=?";
            case "TABLE" -> "SELECT id,name,capacity,active,closure_reason FROM dining_tables WHERE id=?";
            case "BILL" -> "SELECT id,table_id,table_name,status,total,penalty_applied,paid_total,payment_method FROM bills WHERE id=?";
            default -> throw new IllegalArgumentException("Unknown audit entity");
        };
        var rows=db.queryForList(sql,id);if(rows.isEmpty())return null;
        var row=rows.getFirst();
        if(type.equals("MENU"))row.put("package_ids",db.queryForList("SELECT package_id FROM menu_packages WHERE menu_id=? ORDER BY package_id",Long.class,id));
        return row;
    }
    public void record(String action,String type,long id,Map<String,Object> before,Map<String,Object> after){
        recordAs(actor(),action,type,id,before,after);
    }
    public void recordAs(String actor,String action,String type,long id,Map<String,Object> before,Map<String,Object> after){
        try{db.update("INSERT INTO audit_events(actor,action,entity_type,entity_id,before_data,after_data) VALUES (?,?,?,?,?::jsonb,?::jsonb)",
                actor,action,type,id,before==null?null:json.writeValueAsString(before),after==null?null:json.writeValueAsString(after));}
        catch(JsonProcessingException e){throw new IllegalStateException("Cannot record audit history",e);}
    }
}
