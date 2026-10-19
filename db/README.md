# Database backup

`dump-db_order_demo-202610081600.backup` เป็น PostgreSQL custom-format backup ของ `db_order_demo` สร้างวันที่ 8 ตุลาคม 2026 เวลา 16:00:49 ด้วย PostgreSQL 17.10 รวม schema และข้อมูล ณ เวลาสำรอง ครอบคลุมโครงสร้างจาก SQL 001–004

SHA-256: `6EB98007A0C4043BD71C572D3F07E174C724DBDF52B9A5283358E9F6C5AF65B7`

Restore ลงฐานข้อมูลใหม่ที่ว่าง เช่น `db_order_demo_restore`:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\createdb.exe' -h localhost -p 5432 -U postgres -W db_order_demo_restore
& 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe' -h localhost -p 5432 -U postgres -W --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction -d db_order_demo_restore .\db\dump-db_order_demo-202610081600.backup
```

หลัง restore ไม่ต้องรัน SQL 001–004 ซ้ำ ก่อนใช้โค้ดปัจจุบันให้รัน `sql/005_staff_audit_history.sql` และ `sql/006_food_orders.sql` ตามลำดับด้วยตนเอง เพื่อเพิ่มบัญชีพนักงาน ประวัติการแก้ไข และระบบออเดอร์/KDS ตั้งค่า `DB_URL` ให้ตรงกับฐานข้อมูลที่ restore และกำหนดรหัสผ่านฐานข้อมูล/แอดมินใน `.env` แยกต่างหาก

คำสั่งนี้ใช้กับฐานข้อมูลใหม่ที่ว่างตามขั้นตอนเท่านั้น `--clean --if-exists` ลบ schema/objects ที่ archive จะสร้างขึ้นใหม่ รวมถึง public เริ่มต้นที่ทำให้ไฟล์นี้ restore แบบเดิมติด `schema public already exists` อย่าชี้คำสั่งนี้ไปฐานข้อมูลร้านที่กำลังใช้งาน

ตรวจวันที่ 19 ตุลาคม 2026: restore archive นี้ลงฐานข้อมูล QA ใหม่ด้วยคำสั่งที่แก้แล้วสำเร็จ รัน 005/006 ต่อได้ และตรวจ legacy migration/ติดตั้ง SQL 001–006 ใหม่ผ่าน ลบเฉพาะฐานข้อมูล QA หลังตรวจ ไม่ได้ restore ทับฐานข้อมูลร้าน ดู `docs/SYSTEM_REVIEW_2026-10-19.md`
