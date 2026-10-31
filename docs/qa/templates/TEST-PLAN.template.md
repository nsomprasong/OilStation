# OilStation — Test Plan Template (same production Supabase database)

**Plan ID:** QA-YYYYMMDD-MODULE-001  
**Status:** DRAFT / APPROVED / IN_PROGRESS / CLOSED  
**Approval:** Owner and approval timestamp (record without credentials)  
**Prepared on:** YYYY-MM-DD  
**QA_RUN_ID:** `QA-YYYYMMDD-MODULE-001`  
**Application:** https://oilstation.goldensoft.cloud  
**Database:** Supabase `cxihsotcpdnalswfoysx` (current/shared, not staging)  
**Browser runner:** Not configured / configured (name, GitHub workflow, run URL)

## 1. Exact in-scope menus and business outcomes

| Menu / submenu | User role | Goal / end state | Included | Excluded |
|---|---|---|---|---|
| <name> | <role> | <observable result> | ... | ... |

**Out of scope:** <explicitly name everything not allowed; especially real money, external mail, coupons, production customer data>

## 2. Pre-test inventory and safeguards

- [ ] Read-only baseline captured: business rows, auth accounts, invitations, audits, billing/commission ledgers, Storage, external integrations
- [ ] Protected existing records are enumerated; no assumptions that the database is empty
- [ ] Verified backup / restore capability, method, timestamp and responsible operator
- [ ] Test user roles are authorized and secrets stored off-repo
- [ ] `QA_RUN_ID` and complete created-ID/object manifest created
- [ ] Appropriate permission to perform test writes on the CURRENT database
- [ ] No scheduled tasks / unapproved emails, live payment, coupon redemption or bank transactions

## 3. Test cases: approval BEFORE execution

| ID | User role | Preconditions | Browser actions (step by step) | Expected UI | Expected API/DB | Evidence | Status |
|---|---|---|---|---|---|---|---|
| MOD-001 | ... | ... | ... | ... | ... | trace/screenshot, SQL | NOT TESTED |
| MOD-002 | ... | ... | ... | ... | ... | trace/screenshot, SQL | NOT TESTED |

Include, where relevant: first use/empty state; create; required-field validation; edit; cancel; save; reread after refresh; permissions; cross-tenant rejection; duplicates; multi-user concurrency; historical/audit correctness; mobile display; keyboard; errors and recovery; cleanup.

## 4. Test-created data and side effects

| Entity/table/service | Test record ID / path | Parent / dependency | How to restore/delete | Must preserve? |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

Do not use name-prefix matching as the only proof of ownership. Keep sensitive actual values out of committed reports.

## 5. Expected cleanup and reset

**Cleanup mode (choose and get explicit signoff):**
- [ ] TEST_ONLY — remove only records created by this QA run; protect previous baseline
- [ ] APPROVED_FRESH_START — separately enumerated removal of pre-existing business records too; requires `RESET-PLAN.md`, verified recovery, and explicit authorization for every protected category

**Keep by default:** schema/migrations, encrypted secrets, required platform bootstrap admin, auth configuration, domains, deployment/CI setup; original business records unless specifically approved.

**Special handling:** Supabase Storage API object deletion; Auth user deletion/session expiry; audit & immutable financial history; external messages/jobs; signed file/receipt evidence.

**Cleanup exit criteria:** no unapproved QA IDs in DB/Auth/Storage/external integrations; preserved baseline intact; zero unexpected finance side effects. Any deviation = BLOCKED.

## 6. Production return-to-service

- [ ] All approved browser cases PASS (with evidence)
- [ ] Unit/API/SQL tests and CI PASS
- [ ] Correct commit merged, preview-only safety flags unchanged unless separately approved
- [ ] Cloudflare Worker clean deploy/rollout completed
- [ ] Fresh login and UI smoke test Desktop + Mobile PASS
- [ ] Health/permissions/critical APIs checked
- [ ] No QA data remains as defined by the approved cleanup scope
- [ ] Final owner review: GO / NO-GO, with blocking issues stated

## 7. Evidence and execution record

Create `docs/qa/runs/<QA_RUN_ID>.md` from `docs/qa/templates/TEST-RUN.template.md`; update after each case and every fix attempt. PASS requires actual browser execution and DB/API verification, not static claims.
