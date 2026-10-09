# FoodFlow — CODEX Handoff

> อัปเดตสถานะ ณ วันที่ 8 ตุลาคม 2026 หลังนำต้นแบบ `FoodFlow_QuickOrder_V2_Codex` มาพัฒนาเป็นระบบจริงกับ Codex

## 1. Repository และสถานะอ้างอิง

- Repository: `https://github.com/bbkiss550/OrderDemo`
- Branch หลัก: `main`
- Commit ระบบหลักที่ใช้อ้างอิงสถานะการพัฒนา: `48c7ed6` — `Build FoodFlow admin with Docker, floor plans, menus and single-package billing`
- Commit เพิ่มฐานข้อมูลสำรอง: `8516d9b` — `Add PostgreSQL database backup and restore instructions`
- Database: PostgreSQL `db_order_demo`
- รายละเอียดผลตรวจล่าสุด: `docs/VERIFICATION.md`
- Database restore instructions: `db/README.md`

เอกสารนี้เป็น handoff ฉบับอัปเดตสำหรับการพัฒนารอบถัดไป และใช้เพื่อแยกให้ชัดเจนระหว่าง Requirement ที่ยืนยันแล้ว งานที่พัฒนาและตรวจสอบแล้ว งานที่ยังไม่ได้พัฒนา และแนวทางพัฒนารอบถัดไป

หากข้อความใน CODEX handoff รุ่นต้นแบบขัดกับเอกสารนี้ ให้ยึดเอกสารนี้และ requirement ล่าสุดเป็นหลัก

---

## 2. Reference และลำดับความสำคัญ

### 2.1 UX/UI Reference หลัก

ให้คง PNG ต้นแบบเดิมจาก `../FoodFlow_QuickOrder_V2_Codex/screenshots/` เป็น **UX/UI Reference หลัก** โดยเฉพาะ flow ของ Customer Quick Order, KDS และรูปแบบหน้าจอรวมของระบบ

ต้นแบบเดิมเป็น HTML/CSS/JS ที่ใช้ LocalStorage และ login จำลอง มีไว้สำหรับอ้างอิง UX/UI, interaction, flow และ responsive layout เท่านั้น

**ห้ามนำ LocalStorage, mock login หรือข้อมูลจำลองจากต้นแบบมาใช้เป็น source of truth ของระบบจริง**

### 2.2 ภาพผลตรวจของระบบจริง

ภาพใน `docs/screenshots/` ใช้เป็นหลักฐานประกอบว่างานที่พัฒนาแล้วมีหน้าจอและพฤติกรรมจริงตามผลตรวจ เช่น หน้าจัดการโต๊ะ ผังโต๊ะ สถานะผังโต๊ะ แพ็กเกจ เปิดบิลแบบหนึ่งแพ็กเกจ บิล ใบเปิดบิล เมนูอาหาร และสวิตช์แพ็กเกจของอาหาร

ภาพใน `docs/screenshots/` **ไม่แทนที่ UX/UI Reference เดิมทั้งหมด** แต่ใช้ประกอบเพื่อให้เห็น implementation ปัจจุบัน

### 2.3 เอกสารประกอบที่ควรอ่านก่อนแก้ระบบ

- `KICKOFF.md`
- `README.md`
- `docs/VERIFICATION.md`
- `docs/FLOOR_PLAN_REQUIREMENTS.md`
- `docs/MENU_REQUIREMENTS.md`
- `db/README.md`

---

## 3. สถานะระบบปัจจุบันโดยสรุป

FoodFlow เริ่มจากต้นแบบ Frontend แบบ HTML/CSS/JS + LocalStorage แต่ปัจจุบันได้พัฒนา **Backend และระบบ Admin/หน้าร้านจริงบางส่วนแล้ว**

| ส่วน | สถานะ |
| --- | --- |
| Spring Boot backend | พัฒนาแล้ว |
| PostgreSQL | เชื่อมใช้งานจริงแล้ว |
| Login / Security | พัฒนาแล้ว |
| Admin Dashboard | พัฒนาแล้ว |
| ตั้งค่าร้าน | พัฒนาแล้ว |
| แพ็กเกจ | พัฒนาแล้ว |
| โต๊ะ / เปิดบิล | พัฒนาแล้ว |
| ผังโต๊ะ | พัฒนาแล้ว |
| ย้ายบิล | พัฒนาแล้ว |
| QR ต่อบิล | พัฒนาแล้ว |
| ใบเปิดบิล | พัฒนาแล้ว |
| VAT / ค่าปรับ / Checkout | พัฒนาแล้ว |
| หมวดหมู่ | พัฒนาแล้ว |
| เมนูอาหาร | พัฒนาแล้ว |
| สิทธิ์อาหารแยกแพ็กเกจ | พัฒนาแล้ว |
| Customer QR landing | พัฒนาแล้วเฉพาะข้อมูลบิล/เวลา/สถานะ |
| Customer Quick Order | **ยังไม่พัฒนา** |
| ตะกร้าส่งอาหารจริง | **ยังไม่พัฒนา** |
| order_round | **ยังไม่พัฒนา** |
| Multi-device ordering | **ยังไม่พัฒนา** |
| Kitchen Display System (KDS) | **ยังไม่พัฒนา** |
| Real-time order updates | **ยังไม่พัฒนา** |
| สถานะอาหารรายรายการ | **ยังไม่พัฒนา** |
| เรียกพนักงาน | **ยังไม่พัฒนา** |
| พนักงานหลายบัญชี / แยก Role | **ยังไม่พัฒนา** |
| รายงาน | **ยังไม่พัฒนา** |
| Payment gateway / online payment | **ไม่มีและยังไม่ใช่ระบบรับเงินจริงออนไลน์** |

**ห้ามอธิบายว่าระบบสั่งอาหารผ่านมือถือหรือ KDS เสร็จแล้วในสถานะปัจจุบัน**

---

## 4. Technology และข้อกำหนดระบบที่ยืนยันแล้ว

### 4.1 Stack

- Java 21
- Spring Boot
- Thymeleaf
- Bootstrap 5
- Sneat 1.0.0 สำหรับ Admin
- PostgreSQL
- Docker Compose

### 4.2 Database / Environment

- Database หลัก: `db_order_demo`
- ค่าเริ่มต้นของ Docker app เชื่อม PostgreSQL เดิมบน Windows
- มี Compose override สำหรับกรณีใช้ PostgreSQL container
- รหัสผ่านและ secret เก็บในไฟล์ตั้งค่าท้องถิ่น เช่น `.env` / local config และไม่ commit เข้า Git
- ปิด Hibernate schema generation
- ปิด Spring SQL auto initialization

### 4.3 Database migration policy

**ห้ามใช้:** Flyway, Liquibase, migration framework อื่น และ auto schema creation/update ตอน start application

การเปลี่ยน schema ต้องใช้ SQL script แยกและรันด้วยตนเองเท่านั้น

SQL ปัจจุบัน:

1. `sql/001_admin.sql`
2. `sql/002_floor_plan.sql`
3. `sql/003_menu_catalog.sql`
4. `sql/004_single_package_bills.sql`

### 4.4 Security

ระบบปัจจุบันใช้ Spring Security, BCrypt, server-side session และ CSRF protection พร้อม login จริง ไม่ใช้ login จำลองจาก prototype

### 4.5 UX/UI Admin

- UI ภาษาไทยเป็นหลัก
- CRUD ภายในโมดูลใช้ Modal เป็นหลัก
- อัปเดตด้วย AJAX/partial update
- หลีกเลี่ยง full-page redirect สำหรับ CRUD
- URL ไม่ใช้ query parameters สำหรับ search/filter/page
- Search ทำงานอัตโนมัติแบบ debounce
- ช่องค้นหามีปุ่มล้างค่า
- ใช้ validation จาก Backend
- การแก้ข้อมูลที่มีโอกาสชนกันใช้ version/optimistic concurrency ตามส่วนที่พัฒนาไว้

---

## 5. Workflow หน้าร้านที่ยืนยันแล้ว

**ลูกค้าเข้าร้าน → พนักงานเลือกแพ็กเกจและจำนวนคน → เปิดบิลพร้อมกำหนดโต๊ะ/ระยะเวลา → พิมพ์ใบเปิดบิลพร้อม QR → ลูกค้าไปโต๊ะและสแกน QR → ลูกค้ารับประทานและสั่งอาหารภายในเวลาที่กำหนด → ชำระเงินหลังทานเสร็จ → ปิดบิล**

กติกา:

- เริ่มนับเวลาทันทีเมื่อเปิดบิลสำเร็จ
- QR ผูกกับ **บิล** ไม่ใช่ QR ถาวรประจำโต๊ะ
- เปิดบิลใหม่ต้องสร้าง QR ใหม่
- QR เดียวของบิลสามารถใช้กับลูกค้าหลายอุปกรณ์ได้
- เมื่อหมดเวลา ลูกค้ายังทานต่อได้
- เมื่อหมดเวลา ตาม requirement ปัจจุบัน **ห้ามส่งคำสั่งอาหารใหม่**
- หมดเวลาไม่ปิดบิลอัตโนมัติ
- บิลยังเปิดจนกว่าจะเช็คบิล/ชำระเงิน/ปิดบิล
- เมื่อปิดบิลแล้ว QR เดิมต้องไม่สามารถใช้สั่งอาหารต่อ
- การเปิดบิลมี idempotency
- ต้องป้องกันโต๊ะเดียวมีหลายบิลเปิดพร้อมกัน

---

## 6. Requirement ล่าสุด: หนึ่งแพ็กเกจต่อหนึ่งบิล

### 6.1 ข้อกำหนดนี้แทนข้อกำหนดเดิม

**Requirement ล่าสุดยืนยันว่า หนึ่งบิลใช้ได้เพียงหนึ่งแพ็กเกจ**

ข้อกำหนดนี้ **แทนที่ requirement รุ่นก่อนที่เคยอนุญาตหรือสื่อความหมายว่าในบิลเดียวสามารถเลือกหลายแพ็กเกจ / แยกแพ็กเกจตามผู้ใหญ่และเด็กได้**

ห้ามย้อนกลับไปใช้ model แบบ:

- ผู้ใหญ่เลือก Standard แต่เด็กเลือก Deluxe ภายในบิลเดียวกัน
- แต่ละคนเลือก Standard/Deluxe/Premium คนละระดับในบิลเดียวกัน
- มีหลาย package_id สำหรับหลายกลุ่มคนในบิลเดียว

Model ที่ถูกต้องคือ: **บิลมีแพ็กเกจเดียว และแพ็กเกจนั้นมีราคาผู้ใหญ่กับราคาเด็กอยู่ในแพ็กเกจเดียวกัน**

### 6.2 ราคาแพ็กเกจปัจจุบัน

| Package | ผู้ใหญ่ | เด็ก |
| --- | ---: | ---: |
| Standard | 399 บาท | 199 บาท |
| Deluxe | 599 บาท | 399 บาท |
| Premium | 899 บาท | 699 บาท |

จำนวนผู้ใหญ่และเด็กสามารถปะปนกันในบิลเดียวได้ แต่ทุกคนอยู่ภายใต้แพ็กเกจเดียวกัน

ตัวอย่าง Standard ผู้ใหญ่ 2 คน เด็ก 3 คน: `(399 × 2) + (199 × 3) = 1,395 บาท` และในโหมดราคารวม VAT ยอดที่ลูกค้าเห็นยังเป็น 1,395 บาท โดยระบบแยกฐานราคา/VAT ภายในตามการคำนวณ

### 6.3 Backend และ Database enforcement

กติกาหนึ่งแพ็กเกจต่อบิลต้อง enforce ที่ Backend validation และ Database constraints/schema ตาม `004_single_package_bills.sql` ห้ามพึ่ง UI อย่างเดียว

### 6.4 Snapshot บิลเก่า

บิลต้องเก็บ snapshot ของชื่อแพ็กเกจ ราคาผู้ใหญ่ ราคาเด็ก VAT mode / VAT rate ระยะเวลา และข้อมูลราคาที่เกี่ยวข้องกับการเปิดบิล การแก้ราคาแพ็กเกจภายหลังต้องไม่เปลี่ยนบิลเก่า

SQL ปัจจุบันออกแบบให้ปรับโครงสร้างโดยยังเก็บ legacy data และบิลเก่าไว้

---

## 7. VAT, ค่าปรับ และ Checkout

### 7.1 VAT

แอดมินเลือกได้ทั้งราคารวม VAT และราคาแยก VAT ระบบต้องคำนวณและแสดงมูลค่าก่อน VAT, VAT และยอดรวมตาม mode ที่ใช้ตอนเปิดบิล และบิลเก็บ snapshot การตั้งค่า VAT

### 7.2 ค่าปรับ

- แอดมินกำหนดค่าปรับกลางเป็น **จำนวนเงินคงที่ต่อบิล**
- เมื่อเช็คบิลที่เกินเวลา ค่าเริ่มต้นคือเลือกคิดค่าปรับ
- พนักงานสามารถยกเว้นค่าปรับได้
- ไม่มี requirement ให้คิดค่าปรับต่อนาทีหรือต่อคน
- หมดเวลาไม่สร้างการชำระเงินและไม่ปิดบิลอัตโนมัติ

### 7.3 การชำระเงิน

ระบบปัจจุบันบันทึกวิธีชำระเงิน บันทึกยอด และปิดบิล พร้อมป้องกันการปิด/ชำระซ้ำตาม flow ที่ทดสอบแล้ว

**ยังไม่มี payment gateway และยังไม่มี online payment จริง**

---

## 8. ใบเปิดบิลและ QR

ใบเปิดบิลเป็นกระดาษลักษณะใบเสร็จ และต้องแสดงอย่างน้อย: ชื่อร้าน เลขบิล โต๊ะ แพ็กเกจ จำนวนผู้ใหญ่/เด็ก ราคาผู้ใหญ่/เด็ก ระยะเวลาบริการ เวลาเริ่ม/สิ้นสุด VAT ยอดรวม และ QR สำหรับบิล

แอดมินกำหนดความกว้างกระดาษและระยะขอบได้ พร้อม preview

QR:

- สร้างต่อบิล
- เปิดบิลใหม่สร้าง QR ใหม่
- ย้ายโต๊ะแล้วยังใช้ QR เดิม
- เมื่อสแกนหลังย้ายต้องเห็นโต๊ะปัจจุบัน
- เมื่อปิดบิล QR เดิมใช้สั่งต่อไม่ได้

---

## 9. ผังโต๊ะ — Requirement และงานที่พัฒนาแล้ว

ระบบผังโต๊ะพัฒนาแล้วตาม `docs/FLOOR_PLAN_REQUIREMENTS.md`

อัปเดต 9 ตุลาคม 2026: แยกเมนู **รับลูกค้าและเช็คบิล** (`/admin/reception`) สำหรับสถานะโต๊ะ เปิดบิล ดู QR ย้ายบิล และเช็คบิล ออกจากเมนู **จัดการผังโต๊ะ** (`/admin/floor-plan`) สำหรับออกแบบ เพิ่มชั้น และแก้พื้นที่/จำนวนที่นั่ง ไม่มีปุ่มสลับโหมดในหน้าเดียวกันแล้ว ทั้งสองหน้าใช้ผังชุดเดียวกัน

หน้ารับลูกค้าแสดงผังเต็มความกว้าง ไม่มีคำอธิบายด้านข้างหรือกล่องแถว/คอลัมน์ กดโต๊ะเพื่อเปิดป็อปอัพสำหรับเปิดบิล ดู QR ย้ายโต๊ะ เช็คบิล และจัดการสถานะรับลูกค้า

ช่อง grid แต่ละช่องเป็นสี่เหลี่ยมจัตุรัส (สัดส่วน 1:1) โดยโต๊ะยังใช้หลายช่องได้และจำนวนที่นั่งแยกจากพื้นที่เช่นเดิม

- ใช้ grid
- เพิ่มชั้นได้
- กำหนด row/column ของแต่ละชั้นได้
- ลากเลือกพื้นที่สร้างโต๊ะได้
- โต๊ะใช้ 1 ช่องหรือหลายช่องได้
- จำนวนช่องกับจำนวนที่นั่งเป็นอิสระ
- รองรับ 1 ช่อง / 2 ที่นั่ง และ 3 ช่อง / 1 ที่นั่ง
- กดช่องใดในพื้นที่โต๊ะเดียวกันต้องเปิดข้อมูลโต๊ะเดียวกัน

สีสถานะ:

- เขียว = โต๊ะว่าง
- เทา = มีบิลเปิด
- แดง = ปิดซ่อม/ปรับปรุง
- หมดเวลาแต่ยังไม่ปิดบิล = เทา + ไอคอนนาฬิกา/ข้อความหมดเวลา

รองรับเปิดบิล ดูบิล ดู QR เช็คบิล ปิด/เปิดรับโต๊ะ และย้ายบิล

กติกาย้ายบิล:

- ย้ายเฉพาะบิลที่ยังเปิด
- ปลายทางต้องว่าง เปิดรับ และที่นั่งพอ
- ใช้บิลเดิม ราคาเดิม VAT snapshot เดิม เวลาเดิม และ QR เดิม
- ไม่เริ่มเวลาใหม่
- เก็บประวัติการย้าย
- QR/ใบเปิดบิลหลังย้ายแสดงโต๊ะปัจจุบัน
- ไม่มีการรวมบิล
- ตรวจ overlap, ขอบเขตผัง, version conflict และ concurrent destination use

---

## 10. หมวดหมู่และอาหาร — Requirement และงานที่พัฒนาแล้ว

อ้างอิง `docs/MENU_REQUIREMENTS.md`

หมวดหมู่รองรับเพิ่ม/แก้ไขชื่อ ลำดับ และสถานะเปิด–ปิด เมื่อปิดหมวดหมู่ อาหารในหมวดต้องไม่พร้อมขายโดยไม่จำเป็นต้องเปลี่ยนสถานะเดิมของแต่ละอาหาร

อาหารรองรับชื่อ หมวดหมู่ คำอธิบาย Emoji รูป ลำดับ และสถานะขาย

รูป:

- JPG / PNG
- ไม่เกิน 2 MB
- ตรวจ MIME/เนื้อไฟล์จริง
- ตรวจขนาดภาพ
- เก็บใน PostgreSQL

อาหารแต่ละรายการมีสวิตช์อิสระสำหรับ Standard, Deluxe และ Premium เปิดหลายแพ็กเกจได้หรือปิดทุกแพ็กเกจได้ ปิดสวิตช์หนึ่งแพ็กเกจต้องไม่เปลี่ยนอีกแพ็กเกจ และผู้ใหญ่/เด็กในแพ็กเกจเดียวกันใช้สิทธิ์อาหารชุดเดียวกัน

Customer Quick Order ในรอบถัดไปต้องอิง package_id เดียวจากบิล

มีตัวกรองหมวดหมู่/แพ็กเกจ, debounce search, clear search และ version check ป้องกันบันทึกทับ

---

## 11. SQL และ Database Backup

SQL manual ปัจจุบัน:

- `sql/001_admin.sql`
- `sql/002_floor_plan.sql`
- `sql/003_menu_catalog.sql`
- `sql/004_single_package_bills.sql`

Backup: `db/dump-db_order_demo-202610081600.backup`

- PostgreSQL custom-format backup
- Database: `db_order_demo`
- วันที่สร้าง: 8 ตุลาคม 2026 เวลา 16:00:49
- PostgreSQL 17.10
- รวม schema และข้อมูล
- ครอบคลุม SQL 001–004

Restore instruction อยู่ใน `db/README.md`

สถานะการตรวจ:

- `pg_restore --list` ผ่าน
- ถอด archive เป็น SQL ผ่าน
- **ยังไม่ได้ทดลอง restore ลงฐานข้อมูลจริง**

อย่าเขียนว่า restore test ผ่านจนกว่าจะได้ทดสอบ restore ลง database จริง

---

## 12. Verification ที่ทำแล้ว

รายละเอียดเต็มอยู่ใน `docs/VERIFICATION.md`

ผ่านแล้ว:

- Docker build
- Java unit tests
- application health
- Spring Security login
- auth guard
- CSRF
- validation
- VAT inclusive/exclusive
- bill snapshot
- idempotency
- concurrent bill opening protection
- QR
- receipt/open-bill print page
- expiry behavior
- checkout/payment recording
- floor plan และ floor validation
- bill transfer
- menu/category CRUD
- image validation/storage
- package switches
- single-package-per-bill enforcement
- SQL structure/migration checks ใน schema ทดสอบแยก
- browser QA สำหรับ admin flows ตาม verification

ยังไม่ถือว่าผ่าน:

- เครื่องพิมพ์กระดาษจริง
- การสแกน QR จากโทรศัพท์บน LAN
- mobile visual QA แบบครบถ้วน
- PostgreSQL container mode แบบใช้งานจริง
- restore backup ลง database จริง
- Customer Quick Order
- KDS
- real-time ordering

---

## 13. สิ่งที่ยังไม่ได้พัฒนา

### 13.1 Customer Quick Order

ปัจจุบัน QR landing แสดงข้อมูลบิล โต๊ะ เวลา สถานะหมดเวลา และสถานะบิล แต่ยังไม่มี:

- รายการอาหารที่สั่งได้จริง
- ปุ่ม +/- ที่เชื่อม Backend
- ตะกร้าจริง
- การส่งออเดอร์
- order round
- order items
- ประวัติการสั่งอาหารจริง
- การสั่งพร้อมกันหลายอุปกรณ์

### 13.2 Kitchen Display System

ยังไม่มี KDS, คิวออเดอร์เข้าครัว, real-time update, สถานะอาหารรายรายการ, รับออเดอร์, กำลังปรุง, พร้อมเสิร์ฟ และประวัติฝั่งครัว

### 13.3 ส่วนอื่น

ยังไม่มีระบบเรียกพนักงาน, พนักงานหลายบัญชี, role/permission แยกหน้าที่, รายงาน และ payment gateway

---

## 14. งานถัดไป: Customer Quick Order

> ส่วนนี้คือ **แผนพัฒนารอบถัดไป** ไม่ใช่การประกาศว่า feature ถูกพัฒนาแล้ว และไม่เพิ่ม business requirement ใหม่เกินจากสิ่งที่ยืนยันไว้

### Phase CQ-1 — Data model และ SQL manual

ออกแบบ schema สำหรับการสั่งอาหารจริงให้รองรับ:

- บิลเป็น session หลักของโต๊ะ
- ลูกค้าส่งอาหารได้หลายรอบ
- แต่ละรอบผูกกับบิล
- แต่ละรายการอาหารผูกกับรอบ
- idempotency กันการกดส่งซ้ำ
- snapshot ที่จำเป็นเพื่อให้ประวัติออเดอร์ไม่เสียเมื่อชื่อเมนูถูกแก้ภายหลัง

จัดทำ SQL manual script ถัดจาก 004 และตรวจความเข้ากันได้กับ SQL 001–004/ข้อมูลเดิมก่อน finalize

### Phase CQ-2 — Customer menu read API / server rendering

เมื่อสแกน QR Backend ต้องตรวจทุกครั้ง:

1. QR/token ถูกต้อง
2. บิลยังใช้งานได้
3. บิลยังไม่ปิด
4. ยังไม่หมดเวลาสั่ง
5. package ของบิลเป็นตัวกำหนดสิทธิ์อาหาร
6. category active
7. menu item active/ขายได้
8. menu item เปิดสำหรับ package ของบิล

อย่าเชื่อค่าจาก client ว่าเมนูใดสั่งได้

ยึด screenshots เดิมของ `FoodFlow_QuickOrder_V2_Codex` เป็น UX/UI หลัก โดยเน้น Mobile first, หมวดหมู่เข้าถึงเร็ว, รายการอาหารอ่านง่าย, ปุ่ม +/- สำหรับ Quick Order, ไม่บังคับเปิด option/detail สำหรับอาหารทั่วไป และตะกร้าเห็นง่าย

### Phase CQ-3 — Cart และ Submit Order

Frontend เก็บ state ของตะกร้าระหว่างเลือกได้ แต่ Backend เป็นผู้ตัดสินตอน submit

เมื่อ submit:

- ใช้ idempotency key
- validate bill/token อีกครั้ง
- validate expiry อีกครั้ง
- validate category/menu/package eligibility อีกครั้ง
- validate quantities
- สร้าง order round และ items แบบ atomic transaction
- retry request เดิมต้องไม่สร้างออเดอร์ซ้ำ

หลัง submit สำเร็จ round ที่ส่งแล้วต้องเป็นประวัติ และเริ่มตะกร้ารอบถัดไปได้ถ้าบิลยังสั่งได้

### Phase CQ-4 — Multi-device / concurrency

ทดสอบ QR เดียวหลายเครื่อง, ส่งคนละ round พร้อมกัน, retry, เมนู/หมวดหมู่ถูกปิดระหว่างเลือก, บิลหมดเวลาหรือถูก checkout ระหว่างเปิดหน้ากับกดส่ง และกรณี master package ถูกแก้โดย Backend ต้องเป็นจุดตัดสินสุดท้าย

### Phase CQ-5 — Customer history/status

ต่อหน้าประวัติการสั่งจากข้อมูลจริงแทน prototype/LocalStorage และอย่าแสดงสถานะที่ระบบยังไม่มีจริง

---

## 15. งานถัดไปหลัง Customer Quick Order: KDS

> KDS เริ่มหลังจาก order model และ submit flow ของ Customer Quick Order มีข้อมูลจริงแล้ว

### Phase KDS-1 — Kitchen queue

สร้างหน้าครัวจาก order round/order item จริง ยึด UX/UI screenshots เดิมเป็น reference หลัก และแสดงโต๊ะปัจจุบัน รอบการสั่ง เวลา รายการ และจำนวน

กรณีย้ายโต๊ะ KDS ต้องอ้างโต๊ะปัจจุบันของบิล

### Phase KDS-2 — Order/item status

ออกแบบ lifecycle/API สำหรับสถานะครัวให้สอดคล้องกับ UX/UI ที่ยืนยันในรอบพัฒนา KDS ก่อน implement ต้องตรวจว่าระดับสถานะจะเป็นทั้ง order round, ราย item หรือทั้งสองแบบตาม requirement ที่ผู้ใช้ยืนยันในรอบนั้น

**อย่าสร้าง business rule ใหม่โดยถือว่าได้รับการยืนยันแล้วเอง**

### Phase KDS-3 — Real-time

เมื่อ model/status ชัดเจนแล้วค่อยเชื่อม real-time ระหว่าง Customer status, Kitchen queue และ Admin/หน้าร้านที่เกี่ยวข้อง

WebSocket/SSE เป็น implementation choice ตามความเหมาะสมทางเทคนิค และ Backend/database ต้องเป็น source of truth

### Phase KDS-4 — Concurrency และ recovery

ทดสอบครัวหลายหน้าจอ, กดสถานะพร้อมกัน, reconnect, refresh, event หลุด/ซ้ำ และการเปลี่ยนสถานะจากหน้าจออื่น หลัง reconnect ต้องโหลด state ล่าสุดจาก Backend ได้

---

## 16. เกณฑ์ก่อนเริ่มรอบถัดไป

ก่อน Codex ลงมือ Customer Quick Order ให้:

1. อ่านเอกสารนี้
2. อ่าน `docs/VERIFICATION.md`
3. อ่าน `docs/MENU_REQUIREMENTS.md`
4. อ่าน schema/SQL 001–004 ปัจจุบัน
5. ตรวจ model ของ bill/package/menu ใน code จริง
6. ตรวจ screenshots เดิม 01–10 สำหรับ Customer UX/UI
7. เสนอ schema/API/flow ที่จะเพิ่มโดยไม่ทำลายข้อมูลเดิม
8. แยกให้ชัดว่าอะไรเป็น requirement ที่ยืนยันแล้ว และอะไรเป็น implementation proposal
9. รอการยืนยันเฉพาะกรณีพบ business decision ใหม่ที่ไม่มีคำตอบในเอกสารเดิม

**ห้ามเปลี่ยน requirement หนึ่งแพ็กเกจต่อบิลกลับเป็นหลายแพ็กเกจ**

---

## 17. สิ่งที่ Codex ต้องระวัง

- อย่าถือ prototype LocalStorage เป็น implementation จริง
- อย่ากลับไปใช้ QR ถาวรประจำโต๊ะ
- อย่าสร้าง QR ใหม่ทุกครั้งที่สั่งเพิ่ม
- อย่าเริ่มเวลาใหม่เมื่อย้ายโต๊ะ
- อย่าปิดบิลอัตโนมัติเมื่อหมดเวลา
- อย่าให้หมดเวลายังส่งออเดอร์ใหม่ได้
- อย่าให้บิลปิดแล้ว QR ส่งออเดอร์ได้
- อย่าให้ client เป็นผู้ตัดสิน menu/package eligibility
- อย่าปล่อยให้การแก้ราคา master เปลี่ยนบิลเก่า
- อย่าตีความผู้ใหญ่/เด็กว่าเป็นคนละ package
- อย่าเพิ่ม Flyway หรือ auto schema
- อย่า commit secret/password
- อย่าเขียนเอกสารหรือ UI ว่า Customer Ordering/KDS เสร็จแล้วก่อนมี implementation และ verification จริง
- อย่าถือว่า backup restore ผ่านแล้วจนกว่าจะ restore ลงฐานข้อมูลจริง
- อย่าเพิ่ม business requirement ใหม่เป็น requirement ที่ “ยืนยันแล้ว” หากผู้ใช้ยังไม่ได้ยืนยัน

---

## 18. สรุปสำหรับรอบพัฒนาถัดไป

ระบบ Admin/หน้าร้านพื้นฐาน, billing, package, VAT, QR, floor plan, menu catalog และ checkout มี implementation จริงและผ่าน verification ตาม `docs/VERIFICATION.md`

**จุดเริ่มงานถัดไปคือ Customer Quick Order ไม่ใช่การทำ Admin ใหม่**

Customer Quick Order ต้อง:

- ใช้ bill ที่มี package เดียว
- กรอง menu ตาม package ของ bill
- ตรวจ bill status และเวลาที่ Backend
- ตรวจ category/menu/package active/eligibility ที่ Backend ทุกครั้ง
- ส่งออเดอร์เป็นหลายรอบได้
- มี idempotency
- รองรับหลายอุปกรณ์โดยไม่สร้างข้อมูลซ้ำหรือข้าม validation

หลัง Customer Quick Order มี data model และ submit flow จริงแล้ว จึงต่อ KDS และ real-time

ณ สถานะเอกสารนี้:

**Customer Quick Order และ KDS ยังไม่เสร็จ และต้องไม่ถูกอธิบายว่าเสร็จแล้ว**

หน้ารับลูกค้าปรับปุ่มรับลูกค้า / เปิดบิล และปุ่มยืนยันเป็นขนาดใหญ่ (สูงอย่างน้อย 64px, ตัวอักษร 20px) พร้อมช่องกรอกและปุ่มอื่นที่แตะได้สะดวกสำหรับแท็บเล็ต ยังต้องตรวจบน iPad จริง
