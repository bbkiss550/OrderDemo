package com.foodflow;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReportServiceTest {
    @Test void includesTheEntireThaiCalendarDay() {
        var db=mock(JdbcTemplate.class);
        when(db.queryForMap(anyString(),any(Timestamp.class),any(Timestamp.class))).thenReturn(Map.of());
        var service=new ReportService(db);
        var result=service.sales(LocalDate.of(2026,10,19),LocalDate.of(2026,10,19));
        var since=Timestamp.from(Instant.parse("2026-10-18T17:00:00Z"));
        var until=Timestamp.from(Instant.parse("2026-10-19T17:00:00Z"));
        verify(db).queryForMap(ReportService.PAID+ReportService.SUMMARY,since,until);
        verify(db).queryForList(ReportService.PAID+ReportService.DAILY,since,until);
        verify(db).queryForList(ReportService.PAID+ReportService.PAYMENTS,since,until);
        verify(db).queryForList(ReportService.PAID+ReportService.PACKAGES,since,until);
        assertEquals("Asia/Bangkok",result.get("timezone"));
    }

    @Test void invalidOrExcessiveRangesDoNotQueryTheDatabase() {
        var db=mock(JdbcTemplate.class);
        var service=new ReportService(db);
        var today=LocalDate.of(2026,10,19);
        assertEquals(400,assertThrows(ResponseStatusException.class,
                ()->service.sales(today,today.minusDays(1))).getStatusCode().value());
        assertThrows(ResponseStatusException.class,()->service.sales(today,today.plusDays(366)));
        assertThrows(ResponseStatusException.class,()->service.sales(LocalDate.of(1899,1,1),today));
        verifyNoInteractions(db);
    }

    @Test void aSingleDateAndTheMaximumInclusiveRangeAreSupported() {
        var db=mock(JdbcTemplate.class);
        when(db.queryForMap(anyString(),any(Timestamp.class),any(Timestamp.class))).thenReturn(Map.of());
        var service=new ReportService(db);
        var date=LocalDate.of(2026,10,19);
        assertEquals(date.toString(),service.sales(null,date).get("from"));
        assertEquals(date.toString(),service.sales(date,null).get("to"));
        assertEquals(date.plusDays(365).toString(),service.sales(date,date.plusDays(365)).get("to"));
    }
}
