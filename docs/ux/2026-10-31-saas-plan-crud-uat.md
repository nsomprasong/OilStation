# OilStation — Human-centered SaaS Plan CRUD acceptance (31 Oct 2026)

## Screen intent
Platform Super Admin manages saved station subscription plans. **List first, form on demand.**
Create/edit/archive is separate from VAT configuration; station owners keep their existing *choose a plan* screen.
The interface never charges a customer.

## Step-by-step human walkthrough

| Step | User action | Expected, comprehensible result | Verification |
| --- | --- | --- | --- |
| 1 — Open | Navigate to SaaS Billing as Platform Super Admin | Plan count and cards are visible before any input fields; a clear `+ เพิ่มแพ็กเกจ` action appears; failed loading shows a retry action | UI code + test; real browser pending |
| 2 — Add | Tap add button in header **or** floating `+` on mobile | One form opens; name, billing cycle, start date and 3 clearly named prices are grouped in two steps; internal code is prefilled and advanced | UI code + test; real mobile pending |
| 3 — Preview | Enter QR, HR and combined price | Summary displays all 3 in THB and shows bundle saving or warns if bundle costs more than purchasing separately | Pure price tests PASS in CI; visual UAT pending |
| 4 — Validate | Leave fields blank, enter extra decimal places, wrong date or invalid code | Specific error appears, focus moves to the relevant field; advanced code details opens when needed; no server write | Pure validation/API negative tests PASS; keyboard UAT pending |
| 5 — Save | Tap `บันทึกแพ็กเกจ` once | Button disabled during write, error keeps values; success closes editor, refreshes cards, focuses add action and shows a success status | CI contract tests PASS; real Supabase account E2E pending |
| 6 — Display | Search by name or code, inspect monthly/yearly card | Name, system code, cadence and 3 price options are legible on phone and desktop; empty state includes one clear CTA | CSS/static checks PASS; visual UAT pending |
| 7 — Edit unused | Tap `แก้ไข` on an unused, active 3-price Plan | Read validated values from server, prefill form and save in place only if no customer has ever selected it; stale requests are ignored | API/SQL constraints and tests PASS; real network UAT pending |
| 8 — Edit used | Tap `แก้ไข` on a Plan with checkout/subscription history | UI prepares a **new copy** and explains why original price cannot be changed retroactively; original remains intact | SQL guard code + tests; realistic data UAT pending |
| 9 — Archive | Tap `นำออกจากรายการ` | Branded confirmation explains impact; Cancel returns unchanged; Confirm archives but does not hard-delete history | API/SQL negative tests PASS; real account UAT pending |
| 10 — In-use archive | Try to archive a Plan with active subscription/pending checkout | Server rejects with contextual error; card remains in list | API/SQL tests PASS; real data UAT pending |

## Negative/security requirements
- Every edit and detail read requires authenticated Platform Super Admin role in Worker and database.
- No direct client SQL or service-role credential. UI posts only plan ID and whitelisted editable fields.
- Concurrent customer references must not lead to silent in-place price mutation. DB locks the plan row, checks all subscription and checkout references and refuses changes.
- Archived plan remains in SQL for history, but is hidden from available-plan list.
- Preview operation API remains disabled for full money movement; adding Plan CRUD is not approval to charge customers.

## Release and manual UAT gate
- **Code verification:** GitHub Checks (Node tests + Vite build + Wrangler dry-runs) and seven isolated SQL workflows must pass for the exact PR HEAD.
- **Not yet human-verified:** iPhone Safari, Android Chrome, desktop 1280px, keyboard-only, screen reader; invited-owner checkout with realistic active and pending plans.
- Before the customer-facing preview can use the editor, deploy the reviewed migration `20261031100000_platform_plan_editor.sql` via a controlled migration procedure. Do **not** deploy a UI that calls missing RPCs.
- Back up/verify data first; migration uses `CREATE OR REPLACE FUNCTION` and explicit restricted grants, and does not touch stored plan rows.
- Do not merge or deploy merely on green build if this migration/release sequence is not ready.
