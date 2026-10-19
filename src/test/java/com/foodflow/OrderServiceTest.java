package com.foodflow;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class OrderServiceTest {
    @Test void fingerprintIsStableAcrossMenuOrderButChangesWithQuantities(){
        var first=List.of(new OrderService.Item(2,3),new OrderService.Item(1,2));
        assertEquals(OrderService.fingerprint(first),OrderService.fingerprint(List.of(new OrderService.Item(1,2),new OrderService.Item(2,3))));
        assertNotEquals(OrderService.fingerprint(first),OrderService.fingerprint(List.of(new OrderService.Item(1,3),new OrderService.Item(2,3))));
    }
    @Test void rejectsDuplicateAndOutOfRangeLines(){
        assertThrows(ResponseStatusException.class,()->OrderService.fingerprint(List.of()));
        assertThrows(ResponseStatusException.class,()->OrderService.fingerprint(List.of(new OrderService.Item(1,0))));
        assertThrows(ResponseStatusException.class,()->OrderService.fingerprint(List.of(new OrderService.Item(1,100))));
        assertThrows(ResponseStatusException.class,()->OrderService.fingerprint(List.of(new OrderService.Item(1,1),new OrderService.Item(1,2))));
    }
}
