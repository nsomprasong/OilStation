# OilStation — ตั้งค่า Secret สำหรับข้อมูลจริง (30 ตุลาคม 2026)

เอกสารนี้บันทึก **ชื่อ Environment Variable จริงที่โค้ดใช้อยู่** โดยไม่เก็บค่าลับ และแยก Production/UAT อย่างชัดเจน

## สถานะจริงก่อนเปิดระบบ

- Production Supabase `cxihsotcpdnalswfoysx`: 65 public tables, 30 migrations ในประวัติ; 28 migrations ใหม่ยังไม่ติดตั้ง
- ตรวจ Cloudflare Production Worker `oilstation` ล่าสุด (30 ต.ค.): มี `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `COUPON_SIGNING_KEY`, `BOOTSTRAP_ADMIN_EMAIL`, `RESEND_API_KEY` เป็น `secret_text`; มี `INVITATION_FROM_EMAIL=no-reply@oilstation.goldensoft.cloud`, `INVITATION_EMAIL_ENABLED=false` และ `OILSTATION_API_ENABLED=false`; UAT Worker ยังไม่มี Secret
- `oilstation.goldensoft.cloud` ยังเป็นหน้า Maintenance; UAT Worker ปัจจุบันเป็น Canary
- ปัจจุบันมีผู้ใช้ Supabase Auth **1 ราย** หลังจากทดสอบส่งคำเชิญผ่าน SMTP ไปยัง Gmail สำเร็จ; ยังไม่มีการยืนยันว่าได้รับ membership ของ OilStation และ **อย่าเปิดสมัครสาธารณะ**
- GitHub Actions แยก 8 ชุดตรวจและไม่ Deploy อัตโนมัติ
- โค้ดนี้รองรับธุรกรรมคูปองและเติมเงินที่ต้องผ่านการตรวจหลักฐาน แต่ **Stripe อยู่เฉพาะ Test Mode**; Payroll payout, Commission payout, ธนาคารอัตโนมัติ, Face/Liveness ยังไม่ใช่ระบบ Live ที่เสร็จแล้ว

## A. Cloudflare Production Worker

ลิงก์: https://dash.cloudflare.com/ → Workers & Pages → `oilstation` → Settings → Variables and Secrets → Add → Type: Secret → Deploy

| Key (สะกดตามนี้) | ได้จากไหน | ใช้ทำอะไร | ก่อนใช้จริง |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Supabase Project → Connect หรือ Settings → API Keys | `https://cxihsotcpdnalswfoysx.supabase.co` | ต้องตรงโปรเจกต์ |
| `SUPABASE_ANON_KEY` | Supabase Settings → API Keys → Publishable key | คีย์สาธารณะสำหรับผู้ใช้ Auth | ใช้ `sb_publishable_...` ได้ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API Keys → Secret key | ฐานข้อมูลผ่าน Worker เท่านั้น | ใช้ `sb_secret_...`; ห้ามเปิดเผยในหน้าเว็บ |
| `COUPON_SIGNING_KEY` | สร้างค่าลับสุ่มใหม่อย่างน้อย 32 อักขระ; แนะนำ 32 bytes แบบ hex 64 ตัว | HMAC URL คูปอง | เก็บอย่างปลอดภัย ถ้าหมุนคีย์ลิงก์ที่เซ็นเก่าอาจใช้ไม่ได้ |
| `BOOTSTRAP_ADMIN_EMAIL` | Email ผู้เป็น Platform Super Admin คนแรกที่เจ้าของยืนยัน | ป้องกันการเปิด Super Admin ให้บัญชีอื่น | ต้องเป็น email ที่ยืนยันแล้ว |
| `OILSTATION_API_ENABLED` | ควบคุมโดยผู้ดูแลระบบ | `true` อนุญาตให้ตรวจ Release Readiness ก่อน API/Cron ทำงาน | **ตั้ง `false` จนฐานข้อมูลพร้อม/ทดสอบ E2E** |

ปัจจุบัน release gate ปฏิเสธ API ธุรกิจและ Cron โดยอัตโนมัติหากฐานข้อมูลตอบ readiness ผิด/ยังไม่มี migration แม้ flag ถูกตั้ง true

**คีย์สมัยใหม่:** `sb_secret_...` ส่งใน header `apikey` เท่านั้น; Legacy `service_role` JWT แบบเก่ายังรองรับชั่วคราวผ่าน Bearer. ห้ามนำ server Secret ไปใส่ `NEXT_PUBLIC_*`, JS client หรือใน GitHub source

## B. Login ผ่าน Google/Facebook — ค่าลับอยู่ใน Supabase ไม่ใช่ Cloudflare

Supabase: https://supabase.com/dashboard/project/cxihsotcpdnalswfoysx/auth/providers
- Google: ไป https://console.cloud.google.com/auth/clients สร้าง OAuth Web Client → Client ID/Secret แล้วไป Authentication → Sign In / Providers → Google ของ Supabase
- Facebook: ไป https://developers.facebook.com/apps/ → App Settings / Basic เพื่อดู App ID/Secret แล้วไป Supabase Authentication → Providers → Facebook
- Callback URI ที่ Google/Facebook ต้องอนุญาต: `https://cxihsotcpdnalswfoysx.supabase.co/auth/v1/callback`
- Supabase Authentication → URL Configuration: Site URL `https://oilstation.goldensoft.cloud`; Redirect URLs `https://oilstation.goldensoft.cloud/auth/callback`. หากทดสอบ UAT เพิ่มเฉพาะ `https://oilstation-uat.nsomprasong.workers.dev/auth/callback` อย่างชัดเจน
- Facebook ต้องอนุญาต `email` permission; จัดการ App Review / Live ตามการใช้งานจริง
- Google/Facebook Client Secret **ไม่ต้องใส่ใน Cloudflare Worker** เพราะ Supabase Auth เก็บไว้

## C. อีเมลเชิญ

ไป https://resend.com/api-keys สร้าง Resend API Key หลังยืนยันโดเมนผู้ส่งใน https://resend.com/domains (SPF/DKIM)

Cloudflare Worker `oilstation`:
- `RESEND_API_KEY`: คีย์จาก Resend (Secret)
- `INVITATION_FROM_EMAIL`: **ต้องเป็น `no-reply@oilstation.goldensoft.cloud`** ตามข้อบังคับในโค้ด OilStation ปัจจุบัน ห้ามใช้โดเมน EA
- `INVITATION_EMAIL_ENABLED`: `true` เฉพาะหลังทดสอบการส่ง/ตอบกลับจริง, เริ่ม `false`

## D. OCR ภาพทะเบียนรถ / ปั๊ม / ใบเสร็จ

https://console.cloud.google.com/apis/library/vision.googleapis.com → Enable Vision API และ Billing ตามเงื่อนไข → Credentials → สร้าง API Key ที่จำกัดการใช้งานให้เฉพาะ Cloud Vision API

Cloudflare Worker:
- `GOOGLE_VISION_API_KEY`: Google Cloud API key (Secret)
  
ทดสอบผลภาพจริงและให้ผู้มีสิทธิ์ตรวจภาพก่อนตัดเงิน การ OCR โดยอัตโนมัติไม่ควรอนุมัติยอดเอง

## E. Stripe — **ทดสอบเท่านั้น ยังไม่รองรับการจ่ายจริง**

https://dashboard.stripe.com/test/apikeys → test `sk_test_...` / `pk_test_...`
Stripe Dashboard → Developers/Workbench → Webhooks → test endpoint `https://oilstation.goldensoft.cloud/api/webhooks/stripe` → Signing secret `whsec_...`

Cloudflare Worker:
- `STRIPE_SECRET_KEY`: `sk_test_...` (Secret)
- `STRIPE_PUBLISHABLE_KEY`: `pk_test_...` (Public/variable ได้)
- `STRIPE_WEBHOOK_SECRET`: `whsec_...` (Secret)
- `STRIPE_TEST_PAYMENTS_ENABLED`: เริ่ม `false`; เปิดหลังทดสอบ E2E
- `STRIPE_TEST_RECONCILIATION_ENABLED`: เริ่ม `false`; เปิดเมื่อทดสอบการกระทบยอดแล้ว

**ห้ามใส่ `sk_live_...`**: ตัว Adapter ปัจจุบันรับเฉพาะ Test Mode; Refund/Dispute, Chargeback และ Commission Payout ยังไม่พร้อม Live

## F. LINE (ทางเลือก)

https://developers.line.biz/console/ → เลือก Messaging API Channel → Messaging API → Channel access token

Cloudflare Worker:
- `LINE_CHANNEL_ACCESS_TOKEN` (Secret)
- `LINE_NOTIFICATIONS_ENABLED`: เริ่ม `false` จนผูกผู้รับ/ยินยอม/ทดสอบจริง

## G. GitHub Deployment Secrets — ต้องใส่แยกจาก Cloudflare Worker

GitHub https://github.com/nsomprasong/OilStation/settings/environments
- สร้าง Environment `production` และ `oilstation-uat`; ตั้ง Reviewers ตามที่ต้องการ
- แต่ละ Environment → Environment secrets:
  - `CLOUDFLARE_API_TOKEN` — สร้าง Token แบบจำกัดสิทธิ์ Worker ที่ Cloudflare Dashboard → My Profile → API Tokens
  - เฉพาะ Production `OILSTATION_RELEASE_SUPABASE_URL` — URL ของ Production
  - เฉพาะ Production `OILSTATION_RELEASE_SERVICE_ROLE_KEY` — คีย์ `sb_secret_...` หรือ Legacy service_role สำหรับตรวจ `oilstation_release_status`; เป็น Secret และไม่แสดงใน Log
- **GitHub token ≠ Worker runtime secrets**: ต้องมีทั้งสองชุด; อย่าใส่ Secret ลงไฟล์ `wrangler.jsonc`
- Workflow: https://github.com/nsomprasong/OilStation/actions/workflows/controlled-deploy.yml ; Workflow Dispatch หลัง merge code ที่ผ่าน gate เข้าสู่ main; Production ต้องระบุ `APPROVED_OILSTATION_PRODUCTION_RELEASE`

## ลำดับเปิดข้อมูลจริงแบบไม่ใช้ Supabase Staging Branch

1. ตรวจความครบถ้วนของ 28 SQL migrations ผ่าน 8 isolated GitHub workflows และ backup/restore plan ของ Supabase Production
2. ถ้าข้อมูลจริงมีอยู่แล้ว ต้องมี backup และทดสอบ restore ก่อน Migration จริง; ไม่ใช้คำสั่งลบตารางเพื่อเริ่มใหม่
3. ติดตั้ง migration แบบ forward-only ตามลำดับและตรวจ Supabase Security/Performance Advisors, RLS, Storage, tenant isolation
4. ตรวจ `oilstation_release_status()` หลังติดตั้ง migration ล่าสุด; ต้องคืน `ready:true` และ `schemaVersion:20261029215000`
5. ตั้ง Secret ผ่าน Dashboard โดยผู้ดูแล ไม่ส่งคีย์ในแชทและไม่ commit
6. ตั้ง Google/Facebook callback, Email, OCR, Bank review; ทดสอบจริงด้วยบัญชีทดสอบที่มีสิทธิ์และข้อมูลจำลองก่อนเปิดเงิน/พนักงานจริง
7. Deploy ผ่าน workflow, ตรวจ `/api/health` และ `/api/ready`, ทดลองสิทธิ์สองบริษัท, การคืน/ตัดวงเงิน, การปฏิเสธคำขอและการกู้คืนระบบ
8. เปิด Feature Flags แยกตามบริการที่ผ่านเท่านั้น; **ห้ามเปิด Stripe Live, Payroll Payout, Commission Payout หรือ biometric โดยอาศัย readiness เพียงค่าเดียว**

ลิงก์เอกสารทางการ:
- https://supabase.com/docs/guides/getting-started/api-keys
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook
- https://docs.stripe.com/keys

**ไม่มีข้อมูลลับใดอยู่ในไฟล์นี้**


## อัปเดต: ตรวจเชื่อมต่อด้วย Secret แบบอ่านอย่างเดียว (ยังไม่ได้ Deploy)

ใน feature branch มี endpoint **GET** \`/api/internal/supabase-connectivity\`
ซึ่งเปิดใช้เฉพาะเมื่อผู้ดูแลตั้งค่าสองรายการ **บน Worker ที่ Deploy โค้ดเวอร์ชันนี้**:

- \`OILSTATION_DIAGNOSTICS_ENABLED=true\` (ปิดไว้ก่อน)
- \`DIAGNOSTICS_BEARER_TOKEN\` เป็นรหัสสุ่มใหม่ 32 ตัวขึ้นไปแบบ Secret
  และ **ห้ามใช้ค่าของ \`SUPABASE_SERVICE_ROLE_KEY\` แทน**

ต้องส่ง \`Authorization: Bearer <DIAGNOSTICS_BEARER_TOKEN>\` ด้วยเครื่องมือที่
ส่ง Header ได้ (ไม่ใช่เปิดลิงก์ใส่รหัสใน URL) หากปิด/ไม่มี Token ให้ 404
ถ้า Header ผิด 401 และหากทดสอบไม่ผ่านให้ 503

ระบบทดสอบด้วยการอ่าน Supabase Auth settings ผ่าน Publishable Key และเรียก
PostgREST Fuel Catalog \`limit=0\` ด้วย Service Role Key เพื่อพิสูจน์ว่า
ผ่านการยืนยันตัวตนจริง **ไม่มีการอ่านแถวข้อมูลลูกค้า/พนักงาน ไม่มีการเขียน**
และไม่คืนค่าคีย์ใน Response

ตัวนี้ไม่ได้เปิด API ธุรกิจ (ให้ \`OILSTATION_API_ENABLED=false\` ต่อไป)
และไม่ทำให้ Migration/Release readiness ที่ค้างอยู่ผ่านโดยอัตโนมัติ
ควรปิดฟีเจอร์และลบโทเค็นตรวจหลังใช้งานสำเร็จ

*ผ่านการทดสอบตัวจำลองใน GitHub Actions เท่านั้น ยังไม่มีผลยืนยัน End-to-End
จาก Worker ที่ Deploy จริง*



## การทดสอบอีเมลจริงและเทมเพลตภาษาไทย (30 ต.ค. 2026)

- Resend ยืนยันโดเมน `oilstation.goldensoft.cloud` แล้ว; Supabase Auth SMTP ส่งอีเมลเชิญที่ Gmail รับได้ โดยแสดงผู้ส่ง `OilStation <no-reply@oilstation.goldensoft.cloud>`
- **ยังไม่ใช่การทดสอบ Cloudflare Worker → Resend API**; การที่ชื่อ Secret มีอยู่ไม่ได้ยืนยันว่าคีย์ส่งผ่าน API ได้จริง
- เตรียมไฟล์ HTML ภาษาไทยครบ 6 ประเภทใน `supabase/email-templates/` และมีคู่มือ `docs/release/2026-10-30-resend-thai-email-setup.md`
- ไฟล์ GitHub ไม่แก้ Hosted Supabase Auth Email Templates อัตโนมัติ ต้องนำ HTML ไปวางและ Save ใน Supabase Dashboard
- คง `INVITATION_EMAIL_ENABLED=false` และ `OILSTATION_API_ENABLED=false` บน Production จนกว่าจะผ่านการทดสอบ UAT แยกและการอนุมัติ Release
