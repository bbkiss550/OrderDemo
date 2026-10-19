package com.foodflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditServiceTest {
    @Test void staffSnapshotsNeverSelectPasswordHashes(){
        var db=mock(JdbcTemplate.class);
        when(db.queryForList("SELECT id,username,display_name,role,active FROM staff_users WHERE id=?",1L)).thenReturn(List.of(new HashMap<>(Map.of("id",1L,"username","admin","display_name","Admin","role","ADMIN","active",true))));
        var service=new AuditService(db,new ObjectMapper());assertFalse(service.snapshot("STAFF",1).containsKey("password_hash"));
        assertThrows(IllegalArgumentException.class,()->service.snapshot("password_hash",1));
    }
}
