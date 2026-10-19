package com.foodflow;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestControllerAdvice(assignableTypes={AdminController.class,OrderController.class,OrderPrintController.class})
public class ApiErrors {
    @ExceptionHandler(ResponseStatusException.class) ResponseEntity<?> response(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message",e.getReason()==null?"ไม่สามารถดำเนินการได้":e.getReason()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class}) ResponseEntity<?> validation(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("message","ข้อมูลไม่ถูกต้อง กรุณาตรวจชื่อ จำนวน ราคา และค่าที่กรอก"));
    }
    @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> duplicate(DataIntegrityViolationException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message","ข้อมูลซ้ำหรือถูกใช้งานอยู่ กรุณาตรวจสอบแล้วลองใหม่"));
    }
    @ExceptionHandler(org.springframework.dao.TransientDataAccessException.class) ResponseEntity<?> retry(Exception e){
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message","ข้อมูลกำลังถูกอัปเดตพร้อมกัน กรุณาลองส่งคำขอเดิมอีกครั้ง"));
    }
}
