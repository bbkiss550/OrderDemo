package com.foodflow;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReportService {
    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Bangkok");
    // Aggregate people per bill first so adult/child lines never multiply bill totals.
    static final String PAID = """
        WITH selected_bills AS (
          SELECT * FROM bills WHERE status='PAID' AND paid_at>=? AND paid_at<?
        ), guests AS (
          SELECT l.bill_id, sum(l.quantity) AS guests,
            coalesce(sum(l.quantity) FILTER (WHERE l.audience='ADULT'),0) AS adults,
            coalesce(sum(l.quantity) FILTER (WHERE l.audience='CHILD'),0) AS children
          FROM bill_lines l JOIN selected_bills b ON b.id=l.bill_id GROUP BY l.bill_id
        ), paid AS (
          SELECT b.*, coalesce(g.guests,0) AS guests, coalesce(g.adults,0) AS adults,
            coalesce(g.children,0) AS children,
            CASE WHEN b.penalty_applied THEN b.penalty_rate ELSE 0 END AS charged_penalty
          FROM selected_bills b LEFT JOIN guests g ON g.bill_id=b.id
        )
        """;
    static final String TOTALS = """
        count(*) AS bill_count, coalesce(sum(guests),0) AS guests,
        coalesce(sum(adults),0) AS adults, coalesce(sum(children),0) AS children,
        coalesce(sum(subtotal),0) AS subtotal, coalesce(sum(vat),0) AS vat,
        coalesce(sum(total),0) AS service_total, coalesce(sum(charged_penalty),0) AS penalty_total,
        coalesce(sum(paid_total),0) AS paid_total,
        coalesce(round(sum(paid_total)/nullif(count(*),0),2),0) AS average_bill
        """;
    static final String SUMMARY = "SELECT " + TOTALS + " FROM paid";
    static final String DAILY = "SELECT to_char(paid_at AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD') AS day, "
            + TOTALS + " FROM paid GROUP BY 1 ORDER BY 1";
    static final String PAYMENTS = "SELECT coalesce(payment_method,'UNKNOWN') AS payment_method, "
            + TOTALS + " FROM paid GROUP BY 1 ORDER BY 1";
    static final String PACKAGES = "SELECT package_id, coalesce(package_name,'แพ็กเกจเดิม') AS package_name, "
            + TOTALS + " FROM paid GROUP BY 1,2 ORDER BY paid_total DESC,2,1";

    private final JdbcTemplate db;
    public ReportService(JdbcTemplate db) { this.db = db; }

    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Map<String,Object> sales(LocalDate from, LocalDate to) {
        LocalDate start = from != null ? from : to != null ? to : LocalDate.now(SHOP_ZONE);
        LocalDate end = to != null ? to : start;
        if (start.isAfter(end) || ChronoUnit.DAYS.between(start,end)>365
                || start.getYear()<1900 || end.getYear()>2200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "เลือกช่วงวันที่ให้ถูกต้อง สูงสุดครั้งละ 366 วัน");
        }
        Timestamp since = Timestamp.from(start.atStartOfDay(SHOP_ZONE).toInstant());
        Timestamp until = Timestamp.from(end.plusDays(1).atStartOfDay(SHOP_ZONE).toInstant());
        return Map.of("from",start.toString(),"to",end.toString(),"timezone",SHOP_ZONE.getId(),
                "summary",db.queryForMap(PAID+SUMMARY,since,until),
                "daily",db.queryForList(PAID+DAILY,since,until),
                "payments",db.queryForList(PAID+PAYMENTS,since,until),
                "packages",db.queryForList(PAID+PACKAGES,since,until));
    }
}
