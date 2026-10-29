# Fuel Station SaaS — Design Specification (ฉบับร่างเพื่ออนุมัติ)

**วันที่:** 29 ตุลาคม 2026  
**สถานะ:** Revised Draft / Awaiting owner approval (ยืนยันขั้นตอนเปิดขายน้ำมันตามแบรนด์: เจ้าของเลือกสินค้าและใส่ราคาก่อนเปิดใช้)  
**ขอบเขต:** แพลตฟอร์ม SaaS สำหรับปั๊มน้ำมันหลายแห่ง โดยขายโมดูล QR Fuel Coupon และ HR & Payroll แยกกันหรือรวมกัน  
**ข้อจำกัดกระบวนการ:** เอกสารนี้ยังไม่ใช่การอนุมัติให้เริ่มเขียนโค้ด สร้างโปรเจกต์ Merge หรือ Deploy

## 1. วัตถุประสงค์และหลักการ

สร้างแพลตฟอร์มเดียวที่ผู้พัฒนาให้บริการกับเจ้าของปั๊มน้ำมันหลายราย แต่ละเจ้าของมีหลายปั๊มได้ ปั๊มแต่ละแห่งเลือกใช้เฉพาะ **QR Fuel Coupon**, **HR & Payroll** หรือ **ทั้งสองโมดูล** และเสียค่าสมาชิกรายปั๊มตามราคา/โปรโมชั่นที่ Platform Super Admin ตั้งค่าเอง ลูกค้าบริษัทเดียวกันมีความสัมพันธ์กับหลายปั๊มได้ แต่ยอดเงิน บัญชีเครดิต ราคาและสิทธิ์ตามปั๊มต้องแยกจากกัน

เป้าหมาย UX: สะอาด เรียบง่าย ข้อความน้อย ทำงานหลักได้รวดเร็วทั้งมือถือและคอมพิวเตอร์ แสดงเมนู/แดชบอร์ดอัตโนมัติตามบทบาทและโมดูลที่เปิดใช้ **ห้ามเปิดสมัครสมาชิกสาธารณะ**

**ไม่นำมารวม:** เครื่องรูดจ่ายน้ำมันอัตโนมัติที่ผูกหัวจ่ายจริง, การรับเงินเติมเครดิตปั๊มผ่านบัญชี Stripe ของผู้พัฒนา, การเปิดให้พนักงานแก้ยอดเงินได้ตามอำเภอใจ และการเชื่อมธนาคาร/ระบบเงินเดือนทุกแห่งแบบไร้การทดสอบ

## 2. ทางเลือกสถาปัตยกรรมและผลการตัดสินใจ

พิจารณา (A) Modular Monolith — โมดูลแยกในแอปหลักและธุรกรรมฐานข้อมูลร่วมกัน; (B) Microservices — แยกทุกบริการตั้งแต่ต้น; (C) Hybrid — แยกงานหนักบางประเภทตั้งแต่ต้น **ผู้ใช้เลือก A** เพราะธุรกรรมเงิน/คูปองต้องคุมความสอดคล้องสูง และลดต้นทุนการพัฒนา/ดูแล แนวทางปฏิบัติคือ backend แบบ modular monolith พร้อมงาน background, queue และ adapter แยกขอบเขต เพื่อให้แยกบริการ OCR/Face หรือ notification ภายหลังได้โดยไม่ต้องเปลี่ยนกฎธุรกิจ

ข้อเสนอเทคนิค (ยังไม่ใช่การเลือกเทคโนโลยีที่ได้รับอนุมัติ): PostgreSQL ที่มี foreign keys, transactions, isolation และ tenant-scoped access; UI responsive; server-issued sessions; storage ที่มี signed URLs; job processor สำหรับเวลาเปลี่ยนราคา/ส่งแจ้งเตือน/ออกใบแจ้งหนี้; idempotent webhooks และ ledger immutable. สรุปชื่อ framework/ผู้ให้บริการ/hosting ในแผนปฏิบัติต่อไป

## 3. Multi-Tenant และแบบจำลองการให้สิทธิ์

ลำดับบริบท: **Platform → Organization เจ้าของกิจการ → Station ปั๊ม → Module Entitlement**; บริษัทที่มาซื้อน้ำมันใช้ **Corporate Company** ซึ่งเชื่อมหลาย Station ผ่าน **CorporateStationAccount** แยกเงิน/เครดิต/ราคาแต่ละปั๊ม

- แพลตฟอร์มมี Super Admin, Sales และผู้สนับสนุนตามสิทธิ์; เจ้าของปั๊มมี owner/admin/manager/cashier/attendant; บริษัทลูกค้ามี corporate admin/accountant/QR issuer/driver; HR มีผู้จัดการ/ผู้อนุมัติ/พนักงาน
- สิทธิ์เป็น role presets + granular permissions + scope ตาม organization, station, company; เซิร์ฟเวอร์บังคับทุก endpoint และ query ไม่เชื่อเพียง UI
- เจ้าของปั๊มแรกเชิญพนักงานปั๊มและเชิญ corporate admin คนแรก; corporate admin เชิญเจ้าหน้าที่บัญชี ผู้ออก QR คนขับ และกำหนดสิทธิ์ที่ไม่เกินสิทธิ์ของตน; platform เชิญ owner คนแรก
- ลูกค้าบริษัทเดียวที่มาใช้ปั๊มใหม่ต้องได้รับการเปิดบัญชีสัมพันธ์จากปั๊มแห่งใหม่ก่อน ไม่มีการแชร์ balance ระหว่างปั๊ม
- Sales เข้าดู/ดูแลได้เฉพาะปั๊มที่มอบหมาย พร้อมสิทธิ์เฉพาะงาน; ไม่ได้สิทธิ์แก้เงิน/Payroll/เครดิตโดยอัตโนมัติ
- เมื่อผู้ใช้มีมากกว่าหนึ่งบริบท ให้เลือกเฉพาะสถานีหรือบทบาทที่มีสิทธิ์; เมื่อมีบริบทเดียวเข้าสู่ dashboard อัตโนมัติ

## 4. การเชิญและเข้าสู่ระบบ (Invite Only)

- สร้าง invitation ฝั่งเซิร์ฟเวอร์มี invitee email, target organization/station/company, role & permission grants, expiry, status, nonce/token hash และ inviter; อีเมลส่งลิงก์เชิญแบบใช้ครั้งเดียวและเพิกถอนได้
- ผู้ได้รับเชิญเปิดลิงก์ → เลือก Google หรือ Facebook OAuth → ตรวจสอบความเป็นเจ้าของอีเมลที่เชิญ รวมกรณี Facebook ไม่ส่งอีเมลหรือใช้อีเมลต่างจากที่เชิญ โดยต้องมีขั้นตอนยืนยันอีเมลที่เชิญก่อน claim → เพิ่ม membership เฉพาะ target ที่เชิญ → เข้าสู่ dashboard
- ไม่ใส่ข้อมูลสิทธิ์ที่เชื่อถือได้โดยตรงใน URL; ใช้ token เพื่อตรวจ lookup ที่เซิร์ฟเวอร์ ป้องกัน replay/race/redirect abuse; audit การเชิญและเปลี่ยนสิทธิ์
- **คนขับมี 2 ช่องทางคนละกรณี:** บัญชี Web App จากคำเชิญ หรือ public secret coupon link สำหรับดู QR ใบเดียวโดยไม่ต้อง login; public link ไม่เท่ากับ membership

## 5. Module 1 — QR Fuel Coupon

### 5.0 แบรนด์สถานีและแค็ตตาล็อกน้ำมันสำเร็จรูป (Brand-Aware Fuel Catalog) — เพิ่ม 29 ต.ค. 2569

**ข้อกำหนดที่ยืนยันจากเจ้าของผลิตภัณฑ์:** สถานีปั๊มแต่ละแห่งเลือกแบรนด์ในการสร้างบัญชี เช่น PTT Station, Bangchak, Shell, Caltex, PT, SUSCO และแบรนด์อื่นที่มีในไทย; เมื่อเลือกแล้วแสดงรายชื่อชนิดน้ำมัน *ตามแบรนด์นั้น* จาก master catalog โดยอัตโนมัติ จากนั้น **เจ้าของปั๊มกำหนดราคาขายต่อลิตรของแต่ละรายการเอง** ไม่ดึงราคากลางมาเขียนทับราคาในปั๊ม; สาขาแต่ละแห่งมีชนิดน้ำมันและราคาไม่เหมือนกันแม้อยู่แบรนด์เดียวกัน

**Seed catalog ที่ค้นคว้าเพื่อเตรียมข้อมูล:** `/mnt/data/fuel_brand_catalog_2026-10-29.csv` เป็นเอกสารอ้างอิงก่อนการสร้าง migration/seed code ไม่ใช่ฐานข้อมูลที่นำขึ้น Production แล้ว รายชื่อครอบคลุมแบรนด์หลัก PTT Station, Bangchak, Shell, Caltex, PT, SUSCO และแบรนด์/กลุ่มผู้จำหน่ายที่พบในตารางของสำนักงานนโยบายและแผนพลังงาน เช่น IRPC, PURE, SINOPEC/SUSCO รวมถึงกลุ่ม TPI, PO OIL, ปั๊มอิสระ, แบรนด์อื่น/เพิ่มเติม แบรนด์รายย่อยที่ไม่พบชื่อผลิตภัณฑ์ทางการครบถ้วนจะใช้รายการชนิดมาตรฐานพร้อมสถานะ `review_required` มิใช่อ้างว่าเป็นชื่อทางการค้าเฉพาะแบรนด์

**นโยบายเปิดใช้งานที่เจ้าของผลิตภัณฑ์ยืนยันแล้ว:** เมื่อเลือกแบรนด์ ระบบเสนอรายการน้ำมันที่มีในแค็ตตาล็อกของแบรนด์นั้น แต่สถานะเริ่มต้นของทุกชนิดคือ **ยังไม่เปิดขาย**; เจ้าของปั๊มต้องเลือกชนิดที่มีจริงและกำหนดราคาขายต่อลิตร แล้วจึงกดยืนยันเปิดใช้ได้ ระบบต้องไม่อนุญาตให้สร้างคูปองหรือทำธุรกรรมสำหรับสินค้าที่ยังไม่เปิดใช้หรือไม่มีราคาที่ผ่านการตั้งค่า

**กระบวนการตั้งค่าปั๊ม:**
1. ผู้มีสิทธิ์สร้าง Station ระบุ `station_brand_id` (ต้องเลือกจากรายการแบรนด์ หรือ `OTHER_CUSTOM` โดยใส่ชื่อ); HR-only ก็เก็บแบรนด์ได้ แต่ไม่ต้องสร้างราคาน้ำมันจนกว่าจะเปิด QR module.
2. ระบบแสดง **รายการแนะนำตามแบรนด์** ทั้งชื่อไทย/อังกฤษ, กลุ่มเชื้อเพลิง, ออกเทน/ส่วนผสม (ตามที่ตรวจสอบได้), สถานะและแหล่งข้อมูล; รายการไม่ถูกเปิดขายทั้งหมดอัตโนมัติ.
3. เจ้าของปั๊ม **ติ๊กเลือกชนิดที่ขายจริง** แล้วกำหนด `public_price_per_liter` ของทุกชนิดที่เปิดขาย; ไม่มีราคากลางหรือราคากลางรายวัน prefill เป็นราคาขายจริงโดยไม่ได้อนุมัติ. เจ้าของสามารถเพิ่มรายการเฉพาะปั๊ม เปลี่ยนชื่อที่แสดง หรือปิดชนิดที่เลิกขายได้ โดยไม่แก้ master catalog ของปั๊มอื่น.
4. ยืนยันแล้วบันทึกเป็น `station_fuel_products` ซึ่งอ้างอิง `brand_fuel_products` (หรือ custom id); `fuel_price_versions` และ `fuel_price_schedules` แยกต่อ Station+Product; อนุญาตกำหนดราคาพิเศษรายบริษัทต่อ product.
5. หน้าออก QR และหน้าลงรายการเติมแสดง **เฉพาะน้ำมันที่สถานีนั้นเปิดขาย**; เซิร์ฟเวอร์ตรวจ `station_id`, `product_id`, entitlement และราคา ณ เวลาเริ่มเติม; ไม่ให้เลือกชนิดของแบรนด์/ปั๊มอื่นจาก payload ที่แก้เอง.
6. เมื่อแพลตฟอร์มปรับชื่อหรือเพิ่มผลิตภัณฑ์ใน master catalog, **ห้าม override** ราคาปั๊ม สถานะเปิดขาย กฎราคาพิเศษ หรือประวัติธุรกรรมเดิม; แสดงรายการสินค้าใหม่ให้เจ้าของกดยืนยันรับเพิ่มเอง. ข้อมูลธุรกรรมคง snapshot ชื่อสินค้า/ราคา/brand ขณะเกิดรายการ.
7. เมื่อเปลี่ยนแบรนด์ปั๊ม ต้องมี workflow ตรวจความสอดคล้องของรายการที่เปิดขาย คูปองที่ยังไม่ปิด และประวัติราคา; ห้ามเปลี่ยนสินค้าที่ใช้ในรายการเก่าแบบเงียบ ๆ. การปิดชนิดน้ำมันมีผลกับรายการใหม่เป็นหลัก และคูปอง/ธุรกรรมค้างต้องผ่านขั้นตอนจัดการก่อนเพื่อไม่ให้วงเงินค้างผิด.
8. Super Admin เพิ่ม/แก้แบรนด์และรายการ master ได้ โดยเก็บ `source_url`, `last_verified_at`, `verification_status` (`official_confirmed`, `government_category`, `review_required`, `retired`) และประวัติการแก้ไข; ไม่กล่าวอ้างว่า “ครบทุกยี่ห้อ/ทุกผลิตภัณฑ์” หากยังไม่ยืนยันฐานข้อมูลย่อยที่เปลี่ยนตลอดเวลา. รองรับชื่อทางการค้าในอดีตสำหรับประวัติ.

**แหล่งตรวจสอบเพื่อ seed:**
- ตารางผู้จำหน่าย/ชนิดน้ำมันของสำนักงานนโยบายและแผนพลังงาน (EPPO): https://www.eppo.go.th/data-energy-statistic/energy-price-th/ราคาขายปลีกน้ำมัน/ (ค้นตารางปัจจุบัน)
- PTT/OR ประเภทเชื้อเพลิงและผลิตภัณฑ์มาตรฐาน: https://www.pttor.com/ และ https://www.thaipbs.or.th/news/content/506525
- บางจากผลิตภัณฑ์ S EVO: https://www.bangchak.co.th/th/newsroom/bangchak-news/573/bangchak-launches-s-evo-family-as-best-gasohol-products-in-market-presents-premium-quality-at-old-price-to-support-thais-during-covid-19-outbreak
- เชลล์ FuelSave / V-Power: https://www.shell.co.th/th_th/customer/shell-plus-package.html
- คาลเท็กซ์รายการน้ำมัน: https://www.caltex.com/th/motorists/products-and-services/fuel-prices.html
- PT รายการน้ำมันเชื้อเพลิง: https://www.ptgenergy.co.th/Products/IndexOil
- SUSCO รายการค้นหาสถานีและผลิตภัณฑ์: https://www.susco.co.th/homepage.asp?lang=T

**ขอบเขต:** catalog หมายถึง **เชื้อเพลิงเติมรถ** เท่านั้น ยังไม่รวมสินค้าน้ำมันเครื่อง น้ำมันหล่อลื่น EV charging หรือ LPG/NGV ในกระบวนการ QR เติมน้ำมัน เว้นแต่จะเปิดเป็นประเภทบริการใหม่พร้อมหน่วย/วิธีคิดราคาและข้อควบคุมที่ต่างออกไปในอนาคต.

### 5.1 กฎคูปอง
- Corporate issuer สร้าง QR จำกัดยอดสูงสุด/ปั๊มเป้าหมายแห่งเดียว/วันหมดอายุ (ค่าเริ่มต้น 24 ชม. แก้ได้)/ทะเบียนรถเป็นทางเลือก โดย **ต้องตรวจสอบและกันวงเงินเต็มจำนวนสูงสุดทันทีในธุรกรรมเดียวกับการออกคูปอง** หากวงเงินพร้อมใช้ไม่เพียงพอ ให้ปฏิเสธการออกคูปองและไม่เผยแพร่ QR ที่ใช้ได้; ออกหลายใบพร้อมกันได้เฉพาะเมื่อยอดพร้อมใช้หลังหักยอดที่กันของทุกใบยังเพียงพอ
- แสดง QR ผ่านบัญชีคนขับหรือ shareable secret URL (LINE/SMS); URL คงเดิมแต่ payload QR เปลี่ยนได้เมื่อ issuer ยกเลิก/ออกใบแทน; ยกเลิก token เก่า/QR เก่าทันที; ไม่เปิดยอดเงินรวมบริษัทผ่านลิงก์
- การเปลี่ยนทะเบียนหรือปั๊มต้องให้ issuer ยกเลิกและออกใบใหม่ ไม่แก้ข้อมูลคูปองที่เริ่มเติมแล้ว; ต้องตรวจ lock และ concurrency กับ coupon in-progress
- QR ใช้เติมสำเร็จได้ครั้งเดียว; server ตรวจ scope, expiry, revocation, redemption status, **reservation ที่สร้างสำเร็จแล้ว** และยอด cap; เมื่อสแกนหรือเริ่มเติม **ห้ามกันวงเงินซ้ำ**
- หน้าออกคูปองต้องแสดงยอดคงเหลือ, ยอดที่ถูกกันรวมทุกคูปอง, และยอดพร้อมใช้ ณ ขณะนั้น; หากไม่พอ ให้แสดงยอดที่ขาดและไม่ออกคูปอง (การแสดงยอดเป็นเพียงข้อมูลประกอบ เซิร์ฟเวอร์ต้องตรวจซ้ำอย่างเป็นธุรกรรมตอนยืนยัน)
- คูปองที่ยังไม่เริ่มเติม: เมื่อยกเลิกหรือหมดอายุให้ปลดการกันวงเงินทันทีและเพียงครั้งเดียว; หากต้องยกเลิกออกใหม่ให้ปลดใบเก่าและกันใบใหม่เป็นธุรกรรมที่ป้องกันการแข่งขัน/ความล้มเหลวระหว่างขั้นตอน
- หากคูปองเริ่มเติมแล้ว ให้คงยอดที่กันจนปิดธุรกรรมหรือเข้าสู่กระบวนการแก้ไขรายการค้างอย่างควบคุม; ห้ามปลดเงินก่อนปิดยอดที่อาจเกิดจริง เพื่อป้องกันการใช้เงินซ้ำ

### 5.2 เติมน้ำมันและหลักฐาน
- พนักงานสแกน QR ที่ปั๊ม → ตรวจสถานะ; ถ้าผูกทะเบียนต้องถ่ายภาพทะเบียนจริง **ก่อน** เติม ใช้ OCR อ่านเทียบ; ความเชื่อมั่นต่ำ/อ่านผิดส่ง cashier/manager ยืนยันจากภาพได้ **เฉพาะกรณีทะเบียนจริงตรงกันเท่านั้น**; ห้ามอนุมัติทะเบียนผิดและต้องให้บริษัทออกคูปองใหม่; กรณีไม่ผูกทะเบียนยังบันทึกภาพทะเบียนเป็นหลักฐาน
- พนักงานกด **เริ่มเติมน้ำมัน** หลังตรวจทะเบียน: เซิร์ฟเวอร์บันทึก timestamp เริ่ม, lock public price & negotiated price ของเชื้อเพลิง และตรวจว่าคูปองมียอดกันวงเงินที่ถูกต้องจากขั้นตอนออกคูปองแล้ว **ไม่กันวงเงินเพิ่มอีก**; ป้องกันการเติมซ้ำและความขัดแย้งข้ามอุปกรณ์/กะ
- กรอกหรือ OCR ภาพหัวจ่ายเพื่ออ่านลิตร/ยอดหัวจ่าย จากนั้นคนยืนยัน ตรวจราคาและความสัมพันธ์ยอดเงิน/ลิตร; เก็บภาพหัวจ่าย ภาพทะเบียน ภาพใบเสร็จ; ออกสลิปและประวัติ
- หลังเติมเสร็จ ให้แปลงยอดที่กันไว้เป็นการตัดเงินจริงเพียง **ยอดสุทธิหลังส่วนลดของปริมาณที่เติมจริง** (ไม่เกิน cap) แล้วปลดยอดกันที่เหลือในธุรกรรมเดียวกัน; ป้องกันการตัดยอด/คืนยอดซ้ำ; แยก gross pump display, net corporate amount, difference; เติมจบช่วงราคาปรับในอนาคตยังใช้ราคา ณ **เริ่มเติม**
- Flow แบบ state machine: draft → **reserved+issued** → scanned/verified → fueling (คง reservation เดิม) → completed/settled+release remainder หรือ cancelled/expired+release hold; การออกไม่ผ่านเพราะเงินไม่พอต้องไม่สร้างคูปองที่ใช้ได้; กฎ expiry ระหว่างกำลังเติมต้องกำหนดชัดในการออกแบบละเอียด (ข้อเสนอ: อนุญาตปิดงานที่เริ่มเติมก่อนหมดอายุ พร้อม timeout และรายการตรวจสอบค้างเพื่อไม่ปลดวงเงินก่อนเวลา)

### 5.3 ราคาขายและการเงินลูกค้าบริษัท
- public price ต่อ **station fuel product ที่ปั๊มเปิดขาย** ต่อปั๊ม; special corporate fuel price แบบ fixed per liter หรือ discount from public; ไม่มีเงื่อนไขใช้ public; schedule ราคาในอนาคตตาม timezone ปั๊ม ปรับอัตโนมัติ server-side พร้อม audit
- ปั๊มมีบัญชีธนาคารรับเงินลูกค้าโดยตรง บริษัทโอนเงินผ่าน QR บัญชีปั๊ม ส่ง slip; ฝ่ายปั๊มได้รับแจ้งใน Web App และ LINE (LINE เป็น deep link เข้าเว็บ ต้อง login ไม่อนุมัติใน LINE); ตรวจเงินจริง/สลิปซ้ำแล้วอนุมัติ เพิ่มเงินหลังอนุมัติเท่านั้น
- เจ้าของปั๊มตั้ง credit limit ต่อ CorporateStationAccount ได้; **เมื่อออกคูปอง** ให้กันยอดจาก prepaid ที่พร้อมใช้ร่วมกับ unused authorized credit line ตามกฎเครดิตที่เคยตกลงไว้ (หากจะจำกัดเฉพาะ prepaid ต้องยืนยันนโยบายแยกต่างหาก); เติมเสร็จหัก prepaid ก่อน ส่วนที่เหลือเป็นลูกหนี้; **ยอดกันจากเครดิตยังไม่ถือเป็นหนี้จริงจนกว่าจะเติมเสร็จ**; ห้ามใช้เกิน cap ของคูปอง
- สูตรวงเงินพร้อมใช้สำหรับการออกคูปอง = prepaid คงเหลือที่ยังไม่ถูกตัดจริง + (วงเงินเครดิตอนุมัติ − ลูกหนี้เครดิตที่ใช้อยู่) − ยอดกันคูปองที่ยังไม่เคลียร์ทั้งหมด; ต้องไม่หักยอดกันซ้ำเมื่อบันทึกหนี้หรือเติมเงิน และต้องบังคับใช้ด้วย transaction/row lock กับ ledger แยกบัญชีตามปั๊ม
- เมื่ออนุมัติเงินเข้า ให้ชำระหนี้เก่า **เก่าสุดก่อน** แล้วเหลือจึงเข้า prepaid; รองรับอายุหนี้, เครดิตคงเหลือ, terms รายรายการหรือ statement-cycle รายปั๊ม/บริษัท, due dates, alerts, aging, statement และ ledger ที่แก้ย้อนหลังไม่ได้
- payment ledger และ audit แยกจาก SaaS Stripe ทั้งสิ้น

## 6. Module 2 — HR, Attendance และ Payroll

### 6.1 กะและเวลา
- กำหนดกะเช้า/บ่าย/ดึกและกะเพิ่มได้ เวลามาตรฐานที่ยกตัวอย่าง 06–14, 14–22, 22–06; ทำกะประจำ หมุนเวียนกะ ตารางสัปดาห์/เดือน คัดลอก ย้าย/สลับ และเตือนจำนวนคน/กะซ้อน/เวลาพัก
- พนักงานลงเวลาแทนกะอื่นได้ทันที แต่ส่งอนุมัติย้อนหลัง; ระหว่างรอ **ไม่ตัดสินว่าขาดกะเดิม**; คนถูกแทนรอผู้จัดการระบุเหตุเป็นลา/หยุด/ขาดตามหลักฐาน
- รองรับควบกะ เช่น เช้า+บ่าย, บ่าย+ดึก; เลือกตอกเข้าออกต่อเนื่องครั้งเดียว หรือแยกแต่ละกะ โดยรวมเวลาไม่ซ้ำ; เวลาพักตามตารางหรือ punch break จริง ห้ามหักซ้ำ
- GPS geofence ตั้งรัศมีต่อปั๊ม/บล็อกหรือตั้งรออนุมัติเมื่ออยู่นอกรัศมี; ภาพ live camera พร้อม face match self-hosted; ภาพ/biometrics เป็นข้อมูลอ่อนไหว ต้องกำหนดฐานกฎหมาย/การยินยอมที่เหมาะสม/retention/access และ fallback สำหรับคนที่ระบบจับใบหน้าพลาด
- ขอแก้ timestamp ย้อนหลังพร้อมเหตุผลและหลักฐาน ผู้จัดการอนุมัติ เก็บ record ดิบไม่ลบ; คำนวณ late, absent, actual hours, proposed OT; OT ขออนุมัติได้ทั้งล่วงหน้าและย้อนหลัง อนุมัติเต็ม/บางส่วน/ปฏิเสธ; ชั่วโมง OT ที่ได้รับอนุมัติแยกต่างหาก

### 6.2 Payroll
- รอบจ่ายรายสัปดาห์ รายครึ่งเดือน รายเดือน เลือกตามพนักงาน; รองรับค่าจ้างรายวัน/เดือน รายรับอื่น OT ภาษี ณ ที่จ่าย ประกันสังคม เงินเบิกล่วงหน้า/รายการหักที่อนุญาตตามกฎหมาย และ payslip
- เงินเบิกมีคำขอ/อนุมัติ ยอดคงค้าง แผนคืนรายสัปดาห์หรือรอบจ่ายอื่น กำหนดเริ่มหักงวดใกล้สุดหรือถัดไป; ไม่หักเกินข้อกำหนดแรงงาน
- Payroll run: draft → review → approve & lock → pay/export → reconcile → paid/partial/failed; การแก้เวลา/OT หลังปิดงวดทำ adjustment ใน **งวดถัดไป** ไม่เขียนทับ payroll เก่า; offboarding ต้องมี settlement case หากไม่มีงวดหน้า
- จ่ายเงินสด/โอนเองพร้อมหลักฐาน หรือส่งออก Bank Adapter หลายธนาคาร เลือก bank และบัญชีต้นทาง; ต้อง validate format กับธนาคารแต่ละแห่งก่อนเปิดจริง; export ไม่ใช่ paid ต้อง reconcile ผลโอน
- พนักงานผูก PromptPay ของตน (หมายเลขโทรศัพท์หรือบัตรที่ผูกไว้) และออก QR รายบุคคลพร้อมยอดสุทธิ; สแกนจ่ายจากแอปธนาคาร; ห้ามถือว่า QR/สลิปเพียงอย่างเดียวยืนยันเงินเข้า ต้องตรวจหลักฐาน/ผลโอนและกันจ่ายซ้ำ
- พนักงานเปลี่ยน PromptPay ได้แต่ต้องให้ manager/HR อนุมัติ; verify payee; ไม่เปลี่ยนผู้รับของรายการ locked โดยอัตโนมัติ

## 7. Module Entitlements, Pricing, Promotions และ SaaS Billing

- Each Station มี entitlement `qr_coupon` และ/หรือ `hr_payroll`; ไม่มีโมดูลจะซ่อนเมนูและปิด API ตามสิทธิ์ ไม่ใช่ซ่อน UI อย่างเดียว; เพิ่มโมดูลภายหลังโดยใช้สถานีเดิม
- Platform Super Admin สร้าง pricing rules เอง: flat price ต่อปั๊ม, per-employee, usage tiers, bundle price, monthly/yearly และ per-station override, promotion code/period; เก็บ effective dates + immutable invoice price snapshot
- **นโยบายราคาที่ผู้ใช้เลือก B:** ราคาใหม่มีผลกับลูกค้าใหม่ตาม effective date และกับลูกค้าเดิมใน **รอบต่ออายุถัดไป** (เดือนถัดไปสำหรับรายเดือน, ปีถัดไปสำหรับรายปี); ต้องแจ้งล่วงหน้าก่อนเรียกเก็บราคาใหม่; งวดที่ชำระแล้วและใบแจ้งหนี้ที่ออกแล้วไม่เปลี่ยนย้อนหลัง; ค่า lead time ของการแจ้งเตือนให้กำหนดใน Settings ภายหลัง
- Organization อาจมีหลายสถานี มี billing group รวมหลายปั๊มต่อใบแจ้งหนี้ หรือแยกแต่ละปั๊ม หรือผสมทั้งสองอย่าง; policy เก็บเงิน/ค้างชำระ/ต่ออายุเป็นของ billing group และ entitlement เป็นของแต่ละ station; station ในกลุ่มที่ unpaid เข้าสถานะ overdue/grace ร่วมกัน ไม่กระทบสถานีที่จ่ายแยกและปกติ
- SaaS payment: ราคา/โปรโมชั่น/ใบแจ้งหนี้/รอบต่ออายุจัดใน platform; ส่ง **จำนวนเงินจริง** ไป Stripe PaymentIntents ไม่ต้องสร้าง Product/Price เพื่อจัดการราคาด้วยมือ; ยืนยันผ่าน signed webhook + idempotency; hosted checkout แยกไม่ใช่ UX หลัก: ฝัง Stripe Payment Element ลงในหน้า Platform (ยกเว้น bank 3DS อาจ redirect/challenge)
- Payment method: บัตรคิดราคาปกติ, PromptPay QR **ลด 2%** จากฐานตามนโยบายที่ตั้ง; platform รับภาระค่าธรรมเนียม Stripe ทั้งสองวิธี (ไม่เพิ่ม surcharge ช่องทางบัตร); อัตราและโปรโมชั่นเก็บในฐานข้อมูล platform; ความถูกต้องของ discount กับภาษี/เอกสารเป็นงานตรวจสอบก่อนเปิดใช้
- Auto-charge ของบัตรเป็น checkbox **ไม่เลือกโดยค่าเริ่มต้น**, ขอความยินยอมชัดเจน, มีผลต่อ **billing group ทั้งกลุ่ม**; หากไม่เลือกให้ลูกค้าชำระเองงวดหน้า; สามารถเปิด/ปิดภายหลัง; QR สร้างรายการใหม่ให้สแกนทุกงวด; ตรวจผล authorization และความล้มเหลวของ 3DS/บัตร
- เนื่องจากจัดการ subscription เอง แพลตฟอร์มต้องมี recurring job, dunning/reminders, payment attempts, grace policy, audit, reconciliation, refunds, taxes และ timezone ของแต่ละ invoice

## 8. Platform Sales และ Recurring Commission

- Platform มี Sales ผู้ดูแลเฉพาะสถานีที่ได้รับมอบหมาย สามารถช่วยจัดการข้อมูลปั๊ม/ลูกค้าภายใต้ explicit support permission; log ทุก action; ไม่ให้สิทธิ์การเงินอัตโนมัติ
- ตั้งค่าคอมเป็นรายบุคคล/ปั๊ม fixed amount หรือ % ตามเงื่อนไข โดยปรับค่าได้จาก Settings; รายเดือนหรือสมาชิกจ่ายรายปีเลือกได้ว่าจะจ่ายค่าคอมทยอยรายเดือน หรือจ่ายรวดเดียวเมื่อรับชำระรายปี
- **ต้องรับค่าสมาชิกสำเร็จก่อน** จึงเกิด commission entitlement; แยกตาม station แม้ชำระเป็น billing group; revenue/discount/commission basis และ VAT ต้องชัดใน rules
- **ผู้รับค่าคอมคือ Sales ผู้ดูแล ณ ช่วงเวลาที่มีสิทธิ์** ไม่ใช่ผู้ปิดการขายเดิม; เมื่อย้าย Sales ให้แบ่งตามวันที่มีผล (กลางเดือน prorate ตามวัน) พร้อม audit; สมาชิกรายปีที่เก็บล่วงหน้าและจ่ายค่าคอมก่อนแล้วต้องปรับสิทธิ์ของช่วงที่เหลือ
- ค่าคอมที่จ่ายเกินแก่ Sales เก่า → ledger receivable/negative commission adjustment → หักกลบกับ **ค่าคอมในงวดต่อไป** (ไม่หักเงินเดือนอัตโนมัติ) → ยกยอดค้างต่อหากไม่พอ หรือบันทึกรับคืนเงินโดยผู้มีสิทธิ์; ห้ามจ่ายซ้ำ/เกิน entitlement สุดท้าย; refund/chargeback ย้อนปฏิทินโดย adjustment ไม่แก้ ledger เดิม

## 9. ภาพรวมข้อมูล (Conceptual Data)

Core: `organizations`, `stations`, `station_modules`, `users`, `memberships`, `roles`, `permissions`, `invitations`, `audit_events`.  
Coupon: `corporate_companies`, `corporate_station_accounts`, `fuel_brands`, `brand_fuel_products`, `station_fuel_products`, `fuel_types`, `fuel_prices`, `price_schedules`, `corporate_price_rules`, `coupons`, `coupon_versions`, `coupon_redemptions`, `fuel_sessions`, `fuel_evidence`, `credit_lines`, `wallet_ledger`, `credit_reservations`, `topup_requests`, `accounts_receivable`, `statements`.  
HR: `employees`, `shifts`, `rosters`, `shift_assignments`, `replacement_requests`, `attendance_events`, `attendance_adjustments`, `break_events`, `overtime_requests`, `leave_requests`, `biometric_templates`, `payroll_periods`, `payroll_runs`, `payroll_lines`, `salary_advances`, `advance_repayments`, `payouts`, `bank_export_batches`, `employee_promptpay`.  
SaaS: `plans`, `pricing_rules`, `promotions`, `station_subscriptions`, `billing_groups`, `invoice_lines`, `invoices`, `payment_attempts`, `stripe_events`, `payment_methods_consents`.  
Sales: `sales_assignments`, `commission_rules`, `commission_entitlements`, `commission_ledger`, `commission_payouts`.

ข้อมูลนี้เป็น conceptual model; ชื่อ schema และ cardinality จะยืนยันใน design และ plan รายละเอียดก่อน migration

## 10. ความปลอดภัย/ความถูกต้องและ acceptance requirements

- ทุก endpoint ใช้ server-side authorization, scope enforcement, RLS/policies ที่สอดคล้องกับ tenant, object-level access; test cross-tenant, cross-station, cross-role รวม multi-org admin และ Sales
- เงินทุกหน่วยใช้ integer minor units หรือ fixed precision ไม่ใช้ floating point สำหรับธุรกรรม; ledger append-only, transaction locks และ idempotency keys ป้องกัน overspend, duplicate webhooks, double redemption, double payout; **กันวงเงินคูปอง ณ issuance แบบ atomic** และคืนวงเงินจาก cancel/expire/settlement แบบ idempotent; ทดสอบออกคูปองพร้อมกัน, รีเฟรช/รีทราย, ยกเลิกพร้อมสแกน, หมดอายุพร้อมเริ่มเติม, และรายการเติมค้าง
- Brand catalog tests: เลือกแบรนด์ต่างกันได้ชนิดน้ำมันต่างกัน, HR-only ไม่ต้องตั้งราคา, ปั๊มไม่เผลอเปิดขายทุกสินค้า, ตรวจราคาบังคับก่อนขาย, เปลี่ยน/เพิ่มรายการ master ไม่ทับราคาและประวัติของปั๊ม, กัน cross-station/cross-brand product injection, price lock tested.
- Coupon revoke/refill concurrency/price lock tested; resume/timeout session policy; photo evidence access control & retention
- Stripe verify signed webhook, metadata reference and amount against locally locked invoice, reconcile failed/pending/succeeded/refund; Stripe objects ไม่เป็น pricing source-of-truth
- Auth invitation replay prevention, OAuth account binding and email ownership, expiring tokens, audit; platform user ไม่เข้าถึงข้อมูลลูกค้าโดยไร้เหตุผล
- Biometric sensitive data minimized/encrypted/controlled, explicit lawful basis, retention, fallback manual; Thailand PDPA และแรงงาน/ภาษี/ประกันสังคมต้องรับการตรวจสอบก่อน production
- ไม่มีการอ้างว่า integration ทำงานผ่านหรือ build/tests PASS จนกว่าจะ run verification จริง; Mobile/Desktop UX accessibility, performance, audit and abuse checks in development plan

## 11. การแยกช่วงพัฒนา (ข้อเสนอสำหรับแผนภายหลัง)

1. Foundation: tenant/station/roles/invitations/module entitlements, Settings, audit, station billing core.
2. QR Fuel Coupon: corporate-station accounts, **atomic coupon-issuance reservation**, concurrent issuance tests, cancel/expiry releases, fueling settlement, evidence, pricing, credit ledger, topup approvals.
3. HR & Payroll: shifts, attendance, corrections, OT, advances, payroll lock, payslip, PromptPay and bank adapters.
4. Sales commission + pricing/promotions + recurring invoicing/Stripe Embedded UI + dunning + reconciliation.
5. Hardening: load/concurrency/failure scenarios, privacy compliance, external service adapter validation, security and end-to-end testing.

ลำดับจริงและการปล่อย MVP ต้องอนุมัติอีกครั้งก่อนเขียน plan

## 12. ประเด็นเปิดสำหรับการออกแบบละเอียด/ก่อน production

1. จำนวนวัน **แจ้งปรับราคาล่วงหน้า** และจำนวนวัน grace period: ควรตั้งค่าได้ (ยังไม่กำหนดค่าตัวเลข)
2. นิยาม **usage metric** และเวลาตัดยอดพนักงานสำหรับ HR pricing (พนักงาน active ณ วันไหน / เฉลี่ยทั้งเดือน / employee seats)
3. วิธีคิดราคาเมื่อเพิ่ม/ลดโมดูลระหว่างรอบ และรวม/แยกสถานีที่วันต่ออายุต่างกัน (proration)
4. การคิดส่วนลด PromptPay 2% เมื่อรวมโปรโมชัน, VAT, rounding และกฎคืนเงิน
5. กฎการเติมเมื่อคูปองหมดอายุหลังเริ่มเติม/timeout และการยกเลิก QR ในสถานะกำลังเติม รวมถึงระยะเวลาตรวจสอบธุรกรรมค้างที่ยังกันวงเงิน
6. **ยืนยันเพิ่มเติม:** เมื่อผู้ใช้บอกว่า “เงินในบัญชีไม่พอ ไม่ออกคูปอง” หมายถึงวงเงินพร้อมใช้ที่ **รวมวงเงินเครดิตที่ปั๊มอนุมัติ** ตามข้อกำหนดเดิม หรือจำกัดเฉพาะเงิน prepaid จริงเท่านั้น
7. ชุดธนาคารจริง/รูปแบบ Bank Adapter ที่ได้ผ่าน validation และตรวจชื่อผู้รับเงิน PromptPay
8. Face AI open-source model, liveness, PDPA lawful basis/consent/retention, หลีกเลี่ยงการเก็บข้อมูลเกินจำเป็น
9. อัตราภาษี ประกันสังคม เวลาทำงาน OT และการหักค่าจ้างต้องตรวจผู้เชี่ยวชาญไทยก่อนใช้งานจริง
10. กำหนด SLA ความเร็ว ความพร้อมใช้งาน และขีดจำกัดข้อมูล/จำนวนปั๊มตามเป้าธุรกิจ
11. นโยบาย Sales commission กรณี refund, HR vs QR commission bases, ปั๊มไม่มีผู้รับผิดชอบ และการย้ายกลางวัน
12. ตรวจสอบความครบถ้วนของ **ชื่อผลิตภัณฑ์เชื้อเพลิงรายแบรนด์** เป็นระยะ พร้อมยืนยันแบรนด์ชื่อไม่ชัดจากคำขอ เช่น “trail” ก่อนเพิ่มในรายการจริง; สาขาสามารถเพิ่มรายการเฉพาะได้ทันทีภายใต้การตรวจสอบของผู้ดูแล

**คำขออนุมัติ:** โปรดตรวจว่าขอบเขตและกฎธุรกิจตรงตามความต้องการหรือไม่ หากอนุมัติจึงเข้าสู่ `superpowers:writing-plans` เพื่อแยกงานพร้อมเกณฑ์ทดสอบ TDD/ตรวจสอบ/รีวิว โดยไม่ Merge หรือ Deploy จนกว่าจะอนุญาต