# OilStation — Required QA Identity Matrix: Every Scope × Every Role

**Appendix to:** `QA-20261031-MASTER-001`  
**Status:** PLANNED / NOT EXECUTED. The owner requests full role coverage at **every node**, not one generic admin shared across nodes.  
**Identity system:** current Supabase Auth with trusted Admin-provisioned `qa-<alias>@qa.oilstation.invalid` and passwords. No real mailbox, OAuth, email confirmation, or public signup.  
**Automation:** Connected TinyFish `run_web_automation` from regular ChatGPT chat for browser actions; use Supabase read-only verification after writes. Browser-capable plugin does **not** automatically provide an authenticated login profile.  
**Cleanup:** DO NOT delete QA data until the owner explicitly orders the reset **after all** platform, station and corporate tests.  
**No fixture data/accounts have been created.**

## 1. Frozen nodes and names

| Sales creator | Station A | Station B | Corporate customers |
|---|---|---|---|
| `sales01` | `QA-S01-A` | `QA-S01-B` | 3 separate companies per station = 6 |
| `sales02` | `QA-S02-A` | `QA-S02-B` | 3 separate companies per station = 6 |
| **Total** | **4 distinct stations** | **4 station-scoped nodes** | **12 distinct corporate nodes** |

`sXX` codes are `s01a`, `s01b`, `s02a`, `s02b`. `cNN` codes run `c01`…`c12`, ordered as the three customer accounts of `QA-S01-A`, then three of `QA-S01-B`, `QA-S02-A`, `QA-S02-B`. `oNN` codes run `o01`…`o04` for the four organizations created by the existing create-station workflow (one per station); any change to that model requires updating the approved plan before provisioning.

Every new QA account must hold one explicitly tested scope+role membership tied to that node's real UUID. Do not grant other scopes, Platform Super Admin, or roles not in this matrix merely to make tests pass.

## 2. Full role coverage and account totals

| Section | Role code | Required QA aliases | Distinct users | Acceptance objective |
|---|---|---|---:|---|
| Platform | `platform_superadmin` | `existing` | 1 | สร้าง/กำกับระบบ ดูทุกส่วน, QA provision; ห้ามทำสำเนา Super Admin |
| Platform | `platform_sales` | `sales01 / sales02` | 2 | แต่ละคนล็อกอินสร้างปั๊มของตน 2 แห่ง (4 ปั๊มรวม), งานขายและค่าคอมของตน |
| Platform | `platform_support` | `support01` | 1 | ทดสอบสิทธิ์สนับสนุน และปฏิเสธเมนูการเงิน/สร้างผู้ใช้โดยพลการ |
| Organization | `organization_owner` | `oNN-owner` | 4 | สิทธิ์เจ้าของกิจการ/เข้าถึงการกำหนดค่าตามโหนด |
| Organization | `billing_manager` | `oNN-billing` | 4 | ค่าบริการ ใบแจ้งหนี้ และปฏิเสธสิทธิ์แก้ไขข้ามองค์กร |
| Station | `station_owner` | `sXX-owner` | 4 | แพ็กเกจ/ตั้งค่าปั๊ม/เชิญสมาชิก/ราคาและข้อมูลลูกค้า |
| Station | `manager` | `sXX-manager` | 4 | จัดการพนักงาน กะ น้ำมัน ลูกค้า อนุมัติที่ได้รับสิทธิ์ |
| Station | `cashier` | `sXX-cashier` | 4 | รับคูปอง หน้าลาน และสิ่งที่ได้รับสิทธิ์ ไม่เห็นข้อมูลบริษัทอื่น |
| Station | `attendant` | `sXX-attendant` | 4 | พนักงานเติมน้ำมัน ใช้ QR/งานหน้าลานเท่าที่อนุญาต |
| Station | `pump_staff` | `sXX-pump` | 4 | ตรวจการทำงานของ role pump_staff แยกจาก attendant |
| Station | `hr_manager` | `sXX-hr` | 4 | กะ การลงเวลา OT และอนุมัติ; ไม่เข้าถึงบัญชีโดยไม่ได้รับอนุญาต |
| Station | `finance_manager` | `sXX-finance` | 4 | ทดสอบสิทธิ์การเงิน/ตรวจสลิป และตรวจเมนูที่ระบบยังไม่รองรับ |
| Corporate | `corporate_admin` | `cNN-admin` | 12 | โปรไฟล์บริษัทและเชิญบุคลากร |
| Corporate | `coupon_issuer` | `cNN-issuer` | 12 | ออกและยกเลิกคูปองตามสิทธิ์ |
| Corporate | `accountant` | `cNN-accountant` | 12 | ยอดเครดิต การเติมเงิน หลักฐาน และรายงานทางบัญชี |
| Corporate | `finance_manager` | `cNN-finance` | 12 | ทดสอบสิทธิ์ผู้จัดการการเงิน (ถ้าโค้ดยังไม่รองรับให้ลง GAP) |
| Corporate | `driver` | `cNN-driver` | 12 | คนขับรถ เห็นเฉพาะคูปอง/รถที่ได้รับสิทธิ์ ห้ามอนุมัติเงิน |

**Expected identity inventory:** 1 protected existing Platform Super Admin + **99 newly provisioned QA accounts** = **100 total test actors** (the existing Super Admin may be a pre-existing production identity and is NEVER relabeled/deleted automatically). Breakdown: Platform 3 new (`sales01`, `sales02`, `support01`); Organization 8 (2 × 4); Station 28 (7 × 4); Corporate 60 (5 × 12). This is **not** 100 business entities: fixed data remain **4 stations and 12 corporate customer companies**. Do not create an extra QA station/customer to satisfy a role test.

## 3. Alias examples (create ONLY when executing the approved UAT phase)

| Node | Example aliases to provision under actual node UUID |
|---|---|
| Platform | `sales01`, `sales02`, `support01`; retain existing Super Admin |
| Organization `o01` | `o01-owner`, `o01-billing` |
| Station `s01a` | `s01a-owner`, `s01a-manager`, `s01a-cashier`, `s01a-attendant`, `s01a-pump`, `s01a-hr`, `s01a-finance` |
| Company `c01` | `c01-admin`, `c01-issuer`, `c01-accountant`, `c01-finance`, `c01-driver` |

Repeat **identically per respective node** for all 4 organizations, all 4 stations and all 12 companies. IDs must derive from the actual owned station/company created through the browser, not invented UUIDs or pre-existing tenants.

## 4. Required role-specific acceptance cases

For **each of these 99 QA identities** (not just each role type):

1. Log in with username/password via TinyFish's own authorized account profile or protected credentials. Never print password/token/cookies to chat, logs or repository.
2. Query `/api/me` after login and validate EXACT scope ID, role, active status, and no surplus memberships.
3. Check Home navigation and every top-level submenu the role is expected to see. A missing intended menu = **FAIL/GAP**, not PASS.
4. Execute at least one **allowed** representative action through browser, then check actual API and Supabase DB changes including audit trail. If no action is currently implemented for a role, record **GAP**, not a fabricated PASS.
5. Attempt at least one **forbidden** action by calling the API (not only checking hidden buttons), expecting 401/403; ensure DB changes = zero. No client role impersonation.
6. For each Station/Corporate role try reading a second QA node's data; must receive a denied/no-cross-tenant response. For Sales01 vs Sales02, check the other Sales's stations and commission are private.
7. Verify reload, sign-out/in, mobile shell and role-dependent error handling. A role that can view but not write must clearly convey that state.
8. Verify two-person approval flows with **two different identities**, reject self-approval, and check unmodified financial/audit records on denial. No actual live bank transfer or payroll disbursement.
9. Record `<QA_RUN_ID, alias, auth_user_id, membership_id, scope_type, scope_id, role_code, test_id, browser evidence, DB evidence, PASS/FAIL/BLOCKED>` in the run manifest; redact identifying data.
10. Use a separate authorized identity for escalation-negative tests; never grant QA users broader privileges to circumvent permission failures.

### Cross-role scenarios and segregation of duties

| Case | First actor | Second actor | Expected result |
|---|---|---|---|
| Owner creates/memberships | station_owner | manager | Role-scoped changes on only same station |
| Shift request → approval | attendant/pump_staff | hr_manager | Requester not authorized to approve own time |
| QR issuance → pump redemption | coupon_issuer | attendant/cashier | Correct station, company, plate and one-time redemption |
| Top-up request → verification | corporate accountant | station finance_manager/authorized manager | Pending until actual verification, no invented bank receipt |
| Customer finance review | corporate finance_manager | corporate_admin | No cross-company visibility or bypass |
| Sales self-provision → recurring commission | sales01/sales02 | platform_superadmin audit | Own 2 stations, stable creator attribution and no duplicate commission |
| Platform support | support01 | platform_superadmin | Support-only actions; no creation of privileged users/financial approvals |

## 5. Sequence and fixed limits

- Step A (read-only baseline): verify backup/recovery, row counts, existing admins, permissions, Worker flag/QA mode; record prior state. No reset.
- Step B: provision QA `sales01`, `sales02`, `support01` using trusted existing Super Admin after enabling QA mode under approved test plan.
- Step C: login as **Sales01** to create `QA-S01-A/B`; login as **Sales02** to create `QA-S02-A/B`. **CURRENT FUNCTIONAL GAP:** creation API/RPC only accepts Super Admin; fix and deploy before running Step C. Do not pre-create under a Super Admin.
- Step D: create role users for the four real organization nodes and all four station nodes; verify role isolation.
- Step E: create 3 customer companies for each station; now exactly 12 corporate company nodes, then their 60 scoped role users; verify individual and cross-company permissions.
- Step F: execute the 59 master capability categories broken into real browser/SQL/API test cases, including all 99 QA identities and negative access checks. Every FAIL is repaired, CI-verified, merged and deployed before retest.
- Step G: **do not delete automatically**. Wait for the owner's explicit order to reset after all phases complete, inventory each created record/Auth/Storage/ledger item, prepare a separate approved `RESET-PLAN.md`, then clean and verify fresh-start.

## 6. Known permission and environment gaps (NOT TESTED, NOT PASS)

- `platform_support` appears in account provisioning but has no dedicated menu in the current `selectWorkspaceScreens`; verify its intended functionality before PASS.
- Station `finance_manager` and corporate `finance_manager` are selectable QA roles but the current UI may expose only limited or no intended finance actions; check Worker authorization and actual functions. No extra permissions to compensate silently.
- Standalone `employee` role is not currently an allowed QA provisioning role; staff may instead have `attendant`/`pump_staff` station memberships and separate HR employee records. If business rules require a distinct `employee` login, file a design GAP and approve its implementation before adding the role.
- The user-defined exact 99 new-account matrix is a **ceiling and checklist**, not a claim users already exist or can successfully complete actions today. If a role is unsupported in production, record BLOCKED/GAP with reproducible evidence and remedy.
- QA Mode currently remains OFF in Cloudflare; no QA fixtures should be created before plan approval. Browser tool connectivity does not itself authenticate a Super Admin.
