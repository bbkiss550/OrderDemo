package com.foodflow;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import jakarta.validation.Valid;
import java.io.ByteArrayOutputStream;
import java.util.*;
import org.springframework.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
public class AdminController {
    private final AdminService service;
    private final FloorPlanService floorPlan;
    private final MenuService menu;
    public AdminController(AdminService service,FloorPlanService floorPlan,MenuService menu) { this.service=service; this.floorPlan=floorPlan; this.menu=menu; }
    @GetMapping("/") String home() { return "redirect:/admin"; }
    @GetMapping({"/login","/login/failed"}) String login(Model model, jakarta.servlet.http.HttpServletRequest req) {
        model.addAttribute("failed",req.getRequestURI().endsWith("failed")); return "login";
    }
    @GetMapping({"/admin","/admin/tables","/admin/reception","/admin/floor-plan","/admin/packages","/admin/bills","/admin/settings","/admin/menu","/admin/categories"})
    String admin(Model model,jakarta.servlet.http.HttpServletRequest req) {
        model.addAttribute("page",req.getRequestURI());
        model.addAttribute("shop",service.settings()); return "admin";
    }
    @GetMapping("/api/admin/state") @ResponseBody Map<String,Object> state() {
        return Map.of("settings",service.settings(),"packages",service.packages(),"tables",service.tables(),"bills",service.bills(),"stats",service.stats(),"floors",floorPlan.floors(),"categories",menu.categories(),"menus",menu.menus());
    }
    @PostMapping("/api/admin/categories") @ResponseBody Map<String,Object> addCategory(@Valid @RequestBody MenuService.CategoryInput input) { return menu.saveCategory(null,input); }
    @PostMapping("/api/admin/categories/{id}") @ResponseBody Map<String,Object> saveCategory(@PathVariable long id,@Valid @RequestBody MenuService.CategoryInput input) { return menu.saveCategory(id,input); }
    @PostMapping("/api/admin/menu") @ResponseBody Map<String,Object> addMenu(@Valid @RequestBody MenuService.MenuInput input) { return menu.saveMenu(null,input); }
    @PostMapping("/api/admin/menu/{id}") @ResponseBody Map<String,Object> saveMenu(@PathVariable long id,@Valid @RequestBody MenuService.MenuInput input) { return menu.saveMenu(id,input); }
    @PostMapping("/api/admin/menu/{id}/status") @ResponseBody Map<String,Object> menuStatus(@PathVariable long id,@Valid @RequestBody MenuService.StatusInput input) { menu.status(id,input);return Map.of("ok",true); }
    @GetMapping("/media/menu/{id}") @ResponseBody ResponseEntity<byte[]> menuImage(@PathVariable long id) { var image=menu.image(id);return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.type())).cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").body(image.bytes()); }
    @PostMapping("/api/admin/floors") @ResponseBody Map<String,Object> addFloor(@Valid @RequestBody FloorPlanService.FloorInput input) { return floorPlan.createFloor(input); }
    @PostMapping("/api/admin/floors/{id}") @ResponseBody Map<String,Object> saveFloor(@PathVariable long id,@Valid @RequestBody FloorPlanService.FloorInput input) { return floorPlan.updateFloor(id,input); }
    @PostMapping("/api/admin/floors/{id}/delete") @ResponseBody Map<String,Object> deleteFloor(@PathVariable long id,@Valid @RequestBody FloorPlanService.VersionInput input) { floorPlan.deleteFloor(id,input.version()); return Map.of("ok",true); }
    @GetMapping("/api/admin/floors/{id}/layout") @ResponseBody Map<String,Object> layout(@PathVariable long id) { return floorPlan.layout(id); }
    @PostMapping("/api/admin/floors/{id}/layout") @ResponseBody Map<String,Object> saveLayout(@PathVariable long id,@Valid @RequestBody FloorPlanService.LayoutInput input) { return floorPlan.saveLayout(id,input); }
    @PostMapping("/api/admin/tables/{id}/availability") @ResponseBody Map<String,Object> availability(@PathVariable long id,@Valid @RequestBody FloorPlanService.Availability input) { floorPlan.availability(id,input); return Map.of("ok",true); }
    @PostMapping("/api/admin/bills/{id}/move") @ResponseBody Map<String,Object> move(@PathVariable long id,@Valid @RequestBody FloorPlanService.MoveInput input,java.security.Principal actor) { return floorPlan.moveBill(id,input,actor.getName()); }
    @PostMapping("/api/admin/settings") @ResponseBody Map<String,Object> settings(@Valid @RequestBody AdminService.Settings s) { service.saveSettings(s); return service.settings(); }
    @PostMapping("/api/admin/packages") @ResponseBody Map<String,Object> addPackage(@Valid @RequestBody AdminService.PackageInput p) { return service.savePackage(null,p); }
    @PostMapping("/api/admin/packages/{id}") @ResponseBody Map<String,Object> savePackage(@PathVariable long id,@Valid @RequestBody AdminService.PackageInput p) { return service.savePackage(id,p); }
    @PostMapping("/api/admin/menu/{id}/packages/{packageId}") @ResponseBody Map<String,Object> menuPackage(@PathVariable long id,@PathVariable long packageId,@Valid @RequestBody MenuService.PackageAccess input) { menu.packageAccess(id,packageId,input);return Map.of("ok",true); }
    @PostMapping("/api/admin/tables") @ResponseBody Map<String,Object> addTable(@Valid @RequestBody AdminService.TableInput t) { service.saveTable(null,t); return Map.of("ok",true); }
    @PostMapping("/api/admin/tables/{id}") @ResponseBody Map<String,Object> saveTable(@PathVariable long id,@Valid @RequestBody AdminService.TableInput t) { service.saveTable(id,t); return Map.of("ok",true); }
    @PostMapping("/api/admin/bills") @ResponseBody Map<String,Object> open(@Valid @RequestBody AdminService.OpenBill b) { return service.open(b); }
    @GetMapping("/api/admin/bills/{id}") @ResponseBody Map<String,Object> bill(@PathVariable long id) { return service.bill(id); }
    @PostMapping("/api/admin/bills/{id}/checkout") @ResponseBody Map<String,Object> checkout(@PathVariable long id,@Valid @RequestBody AdminService.Checkout c) { return service.checkout(id,c); }
    @GetMapping("/admin/bills/{id}/receipt") String receipt(@PathVariable long id,Model model) {
        model.addAttribute("bill",service.bill(id)); model.addAttribute("shop",service.settings()); return "receipt";
    }
    @GetMapping(value="/admin/bills/{id}/qr",produces="image/png") @ResponseBody ResponseEntity<byte[]> qr(@PathVariable long id) throws Exception {
        var data=new QRCodeWriter().encode(service.bill(id).get("qr_url").toString(),BarcodeFormat.QR_CODE,320,320);
        var out=new ByteArrayOutputStream(); MatrixToImageWriter.writeToStream(data,"PNG",out);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(out.toByteArray());
    }
    @GetMapping("/order/{token}") String customer(@PathVariable String token,Model model) {
        model.addAttribute("bill",service.customer(token)); return "customer-entry";
    }
}
