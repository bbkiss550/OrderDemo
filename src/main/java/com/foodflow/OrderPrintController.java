package com.foodflow;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class OrderPrintController {
    private final OrderService orders;
    private final AdminService admin;
    public OrderPrintController(OrderService orders,AdminService admin){this.orders=orders;this.admin=admin;}

    @GetMapping("/admin/orders/{id}/print")
    String print(@PathVariable long id,Model model,HttpServletResponse response){
        var round=orders.round(id);
        var time=DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss",Locale.forLanguageTag("th-TH")).withZone(ZoneId.of("Asia/Bangkok"));
        model.addAttribute("order",round);
        model.addAttribute("shop",admin.settings());
        model.addAttribute("orderedAt",time.format(((java.sql.Timestamp)round.get("created_at")).toInstant()));
        model.addAttribute("printedAt",time.format(Instant.now()));
        model.addAttribute("statuses",Map.of("PENDING","รอรับออเดอร์","COOKING","กำลังทำ","READY","พร้อมเสิร์ฟ","SERVED","เสิร์ฟแล้ว"));
        response.setHeader("Cache-Control","no-store");
        return "order-ticket";
    }
}
