# OilStation — Test Run Report

**Run ID:** QA-YYYYMMDD-MODULE-001  
**Linked approved plan:** `docs/qa/plans/...`  
**Target:** production-preview at `https://oilstation.goldensoft.cloud`  
**Current production Supabase project:** `cxihsotcpdnalswfoysx`  
**Operator:** ChatGPT through approved runner/tools  
**Started / finished:** <timestamps>  
**Baseline backup verification:** NOT VERIFIED / VERIFIED (reference, no secrets)

## 1. Environment and initial inventory

| Component | Before-run status | Evidence / reference |
|---|---|---|
| Git branch / commit | | |
| Cloudflare Worker deployment ID and safety flags | | |
| Supabase organizations / stations / users / memberships | | |
| Auth users and sessions | | |
| Storage test-owned paths | | |
| Billing, commission and audit footprints | | |

## 2. Browser Test execution

| Test ID | Viewport / role | Steps performed | Actual UI/API/DB result | Evidence | Status |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | NOT TESTED |

Only `PASS`, `FAIL`, `BLOCKED`, `NOT TESTED`. An asserted expectation in code is not execution evidence.

## 3. Defects, repairs and retests

| Issue ID | Reproduction / symptom | Root cause | Fix commit / PR | Retest evidence | Current status |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

## 4. Created-object manifest and external effects

| Service/table | Immutable QA record IDs / paths | Cleanup method | Removed? | Post-cleanup verification |
|---|---|---|---|---|
| PostgreSQL | | | | |
| Auth | | | | |
| Storage | | | | |
| Invites/emails/jobs/other external systems | | | | |

Protected pre-run records must remain unchanged unless separately approved in a full-reset plan. Preserve evidence without exposing credentials or personal data.

## 5. Cleanup / fresh-start approval

**Mode:** TEST_ONLY / APPROVED_FRESH_START  
**Approval reference:** <exact reviewed deletion inventory>  
**Verified backup or restoration source:** <reference>  
**Deletion started / completed:** <timestamps>  
**Leftover records or irreversible effects:** <none, or full details>  
**Result:** PASS / FAIL / BLOCKED / NOT TESTED

## 6. Final deployment and production verification

| Gate | Evidence | Status |
|---|---|---|
| Automated Node / SQL / Browser tests | | |
| GitHub CI and merged commit | | |
| Cloudflare deployed version ID | | |
| Web / health / auth / critical menu smoke | | |
| Current DB reset and data recheck | | |
| Final permissions and safety flags | | |
| Owner GO / NO-GO | | |

**Final verdict:** NOT TESTED / PASS / FAIL / BLOCKED  
**What has NOT been proven:** <explicit limitations>  
**Next required action:** <specific step, owner, and gate>
