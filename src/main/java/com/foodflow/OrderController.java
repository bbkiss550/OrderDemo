package com.foodflow;

import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class OrderController {
    private final OrderService orders;
    public OrderController(OrderService orders){this.orders=orders;}
    @GetMapping("/order/{token}/state")
    ResponseEntity<?> customer(@PathVariable String token,@RequestParam(defaultValue="0") int page){
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(orders.customer(token,page));
    }
    @PostMapping("/order/{token}/rounds")
    Map<String,Object> submit(@PathVariable String token,@Valid @RequestBody OrderService.Submit input){return orders.submit(token,input);}
    @GetMapping("/api/admin/orders")
    Map<String,Object> list(@RequestParam(defaultValue="ACTIVE") String status,@RequestParam(defaultValue="") String q,
            @RequestParam(required=false) Long billId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return orders.list(status,q,billId,page,size);}
    @GetMapping("/api/admin/orders/{id}")
    Map<String,Object> detail(@PathVariable long id){return orders.round(id);}
    @PostMapping("/api/admin/orders/{id}/status")
    Map<String,Object> status(@PathVariable long id,@Valid @RequestBody OrderService.Status input){return orders.status(id,input);}
}
