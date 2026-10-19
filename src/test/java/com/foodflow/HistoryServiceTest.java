package com.foodflow;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HistoryServiceTest {
    @Test void olderBillsAreReachableBeyondTwoHundredRows(){
        var db=mock(JdbcTemplate.class);
        when(db.queryForObject(anyString(),eq(Long.class),any(Object[].class))).thenReturn(205L);
        var result=new HistoryService(db).bills(null,null,"opened","ALL","",10,20);
        assertEquals(205L,result.get("total"));assertEquals(10,result.get("page"));
        verify(db).queryForList(HistoryService.BILL_SELECT+" WHERE 1=1 ORDER BY b.id DESC LIMIT ? OFFSET ?",20,200L);
    }
    @Test void paidDateFiltersUseWholeThaiDaysAndParameterizedSearch(){
        var db=mock(JdbcTemplate.class);
        when(db.queryForObject(anyString(),eq(Long.class),any(Object[].class))).thenReturn(1L);
        new HistoryService(db).bills(LocalDate.of(2026,10,19),LocalDate.of(2026,10,19),"paid","PAID","A%_",0,20);
        verify(db).queryForObject(eq("SELECT count(*) FROM bills b WHERE 1=1 AND b.paid_at IS NOT NULL AND b.paid_at>=? AND b.paid_at<? AND b.status=? AND (cast(b.id AS text) ILIKE ? ESCAPE '!' OR b.table_name ILIKE ? ESCAPE '!')"),eq(Long.class),eq(Timestamp.from(Instant.parse("2026-10-18T17:00:00Z"))),eq(Timestamp.from(Instant.parse("2026-10-19T17:00:00Z"))),eq("PAID"),eq("%A!%!_%"),eq("%A!%!_%"));
    }
    @Test void invalidFiltersAreRejected(){
        var db=mock(JdbcTemplate.class);var history=new HistoryService(db);
        assertThrows(ResponseStatusException.class,()->history.bills(null,null,"sql","ALL","",0,20));
        assertThrows(ResponseStatusException.class,()->history.bills(LocalDate.of(2026,10,20),LocalDate.of(2026,10,19),"opened","ALL","",0,20));
        assertThrows(ResponseStatusException.class,()->history.audit(null,null,"PASSWORD","",0,20));
        verifyNoInteractions(db);
    }
}
