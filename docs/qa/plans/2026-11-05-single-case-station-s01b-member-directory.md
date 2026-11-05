# OS-QA-ST-MEMBER-DIRECTORY-005 — station member list and local search

**Owner rule:** move forward one case at a time; do not rerun cases 001–004 or Platform/Corporate/98-role sweeps.

## One bounded browser task
- Existing fictional QA identity: `s01b-owner` only, with verified station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`.
- Mobile 390×844, Home → **เชิญสมาชิก**, inspect live membership **table** and its **single** in-card search for ชื่อ/อีเมล/บทบาท.
- Call only GET `/api/me`, GET scoped `/api/members/directory`; compare real server count with visible table; search one returned member email; show a genuine empty filter and reset.
- If endpoint is blocked, label API BLOCKED, not business PASS; do not substitute fabricated rows.
- Assert no POST/PUT/PATCH/DELETE to `/api/`; never click edit, deactivate, invite, or QA account create. Do not mutate production records or gate settings.
- Protected one-spec GitHub Action `qa-one-case-sequential.yml` runs only `e2e/qa.case-st-s01b-member-directory-005.pw.mjs` after matching guarded Preview deployment.
- Baseline after case 004: stations=5, companies=12, links=12, wallet_ledger=5, fuel_sessions=2, payroll_runs=0, payouts=0, audit=258.
- A PASS here only proves the membership-directory read/search UI, not role updates, revocation, invitations, HR employees, or tenant RLS under hostile identities.
