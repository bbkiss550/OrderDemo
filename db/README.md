# Database backup

`dump-db_order_demo-202610081600.backup` เป็น PostgreSQL custom-format backup ของ `db_order_demo` สร้างวันที่ 8 ตุลาคม 2026 เวลา 16:00:49 ด้วย PostgreSQL 17.10 รวม schema และข้อมูล ณ เวลาสำรอง ครอบคลุมโครงสร้างจาก SQL 001–004

SHA-256: `6EB98007A0C4043BD71C572D3F07E174C724DBDF52B9A5283358E9F6C5AF65B7`

Restore ลงฐานข้อมูลใหม่ที่ว่าง เช่น `db_order_demo_restore`:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\createdb.exe' -h localhost -p 5432 -U postgres -W db_order_demo_restore
& 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe' -h localhost -p 5432 -U postgres -W --no-owner --no-privileges --exit-on-error --single-transaction -d db_order_demo_restore .\db\dump-db_order_demo-202610081600.backup
```

หลัง restore ไม่ต้องรัน SQL 001–004 ซ้ำ ตั้งค่า `DB_URL` ให้ตรงกับฐานข้อมูลที่ restore และกำหนดรหัสผ่านฐานข้อมูล/แอดมินใน `.env` แยกต่างหาก

ตรวจครั้งนี้ด้วย `pg_restore --list` และถอด archive เป็น SQL สำเร็จ ยังไม่ได้ทดลอง restore ลงฐานข้อมูลจริง
