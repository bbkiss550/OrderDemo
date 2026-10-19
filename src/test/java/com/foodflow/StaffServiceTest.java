package com.foodflow;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StaffServiceTest {
    @Test void protectsTheLastActiveAdminEvenForNonSelfEdits(){
        var db=mock(JdbcTemplate.class);var audit=mock(AuditService.class);var passwords=mock(PasswordEncoder.class);
        when(audit.actor()).thenReturn("another-user");
        when(db.queryForList("SELECT id,username,role,active,version FROM staff_users WHERE id=? FOR UPDATE",1L)).thenReturn(List.of(Map.of("id",1L,"username","last-admin","role","ADMIN","active",true,"version",0L)));
        when(db.queryForObject("SELECT count(*) FROM staff_users WHERE role='ADMIN' AND active",Long.class)).thenReturn(1L);
        var service=new StaffService(db,audit,passwords,"admin","bootstrap");
        assertEquals(409,assertThrows(ResponseStatusException.class,()->service.save(1L,new StaffService.Input("last-admin","Admin","CASHIER",true,0,null))).getStatusCode().value());
        verify(db,never()).update(anyString(),any(Object[].class));
        verify(audit,never()).record(anyString(),anyString(),anyLong(),any(),any());
    }
    @Test void passwordByteLengthIsCheckedBeforeEncodingOrWriting(){
        var db=mock(JdbcTemplate.class);var audit=mock(AuditService.class);var passwords=mock(PasswordEncoder.class);
        var service=new StaffService(db,audit,passwords,"admin","bootstrap");
        assertThrows(ResponseStatusException.class,()->service.save(null,new StaffService.Input("tester","Test","CASHIER",true,0,"ก".repeat(25))));
        verifyNoInteractions(passwords);verify(db,never()).update(anyString(),any(Object[].class));
    }
}
