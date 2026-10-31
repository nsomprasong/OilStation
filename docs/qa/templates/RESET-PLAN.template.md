# OilStation — Fresh-start Reset Plan (shared current database)

**RESET ID:** RESET-YYYYMMDD-001  
**Related QA runs:** <list>  
**Status:** DRAFT / APPROVED / EXECUTING / VERIFIED / BLOCKED  
**Target:** current `cxihsotcpdnalswfoysx` Supabase and `oilstation.goldensoft.cloud`  
**Owner's explicit approval of exact inventory:** <reference>  
**Verified backup & tested restore path:** <reference and timestamp>

## 1. Owner-selected reset scope

- [ ] Only test-run objects created during approved QA
- [ ] **Full fresh-start business data** (includes pre-existing organizations/stations, but only if each is specifically enumerated below)
- [ ] Approved test Auth users / sessions
- [ ] Approved test-only Storage objects
- [ ] Test invitations and scheduled side effects
- [ ] Other category: <explicit list>

**Protected unless separately authorized:** original platform Super Admin, required bootstrap identity, schema/migrations, RLS/policies, app secrets, OAuth provider settings, domain mappings, production Cloudflare safety flags, regulatory/audit history.

## 2. Exact deletion-and-preservation manifest

| Service/schema.table | Exact record IDs/paths or criteria | Existing before testing? | Count before | Delete/keep | Business/legal impact | Restore method |
|---|---|---|---|---|---|---|
| public.organizations | | | | | | |
| public.stations | | | | | | |
| public.app_users / memberships | | | | | | |
| public.sales_assignments | | | | | | |
| public.saas_invoices / finance ledgers | | | | | | |
| public.audit_events | | | | | | |
| auth.users / sessions | | | | | | |
| Supabase Storage bucket/path | | | | | | |
| external services/jobs | | | | | | |

Never use `TRUNCATE CASCADE` or unbounded account/bucket wipes as the routine implementation of this plan. Deletions must be ID-whitelisted and ordered by actual dependencies. Historical financial/audit obligations may make a true full wipe inappropriate; in that case mark the requested reset BLOCKED and obtain approved migration/disposal plan.

## 3. Preconditions

- [ ] All browser test writers stopped and external hooks/tasks disabled where approved
- [ ] Backups verified and restore/recovery process rehearsed for this target
- [ ] Actual database, storage and Auth inventories reconciled with above list
- [ ] All payments, payouts, coupon redemptions and bank-side actions explicitly excluded or reconciled
- [ ] No live customers depend on records being removed
- [ ] Owner authorizes exact operation and expected downtime

## 4. Ordered reset and verification

1. Pause writes with authorized maintenance controls; record actual starting counts.
2. Remove approved test-owned external jobs/hooks/files through provider APIs; Storage deletions must use Storage API.
3. Delete approved child records then parent records with verified FK plan and transactional checkpoints.
4. Delete approved Auth test users via supported administration; verify refresh-token/session handling and outstanding JWT expiry window.
5. Recheck protected baseline, row counts, storage inventory, and absence of QA IDs. Preserve permitted immutable audits.
6. Redeploy the approved Cloudflare Worker code as the serverless runtime reset, refresh affected caches and browser sessions; **a redeploy does not clear Supabase data**.
7. Verify auth first use, Home and critical modules, Worker health and safety flags, successful SQL/API reads, and unexpected external effects.
8. Restore normal operations only after owner GO decision and final evidence.

## 5. Final expected clean-state counts and decision

| Resource | Expected count/state | Observed | PASS/FAIL |
|---|---|---|---|
| Test-only Auth users | 0 | | |
| Test-only Storage paths | 0 | | |
| Approved test-run DB object IDs | 0 | | |
| Protected bootstrap admin | preserved | | |
| Business baseline / approved fresh start | | | |
| Outstanding financial / audit obligations | reconciled | | |
| Worker version and health | current and verified | | |
| Login / permissions / smoke | PASS | | |

**If any step fails:** stop, mark BLOCKED, do not claim system reset or production go-live readiness; execute reviewed recovery path.
