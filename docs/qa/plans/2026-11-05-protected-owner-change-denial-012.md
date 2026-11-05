# OS-QA-ST-PROTECTED-OWNER-CHANGE-DENIAL-012

- Sequential after 011 PASS; never reexecute cases 001–011.
- QA owner `s01b-owner` with one scoped membership; mobile 390×844. GET scoped member directory and identify exactly one active station owner. POST `/api/members/change` `action=edit`, `roleCode=station_owner` — same as existing role to avoid accidental demotion even if the API mishandles a protected member.
- Expected HTTP **403** `permission_denied`; independently re-read directory and require owner still active and original membership. No accepted mutation, new audit event, finance or HR effects.
- Baseline before: memberships 100, s01b 7, audit 260, payroll_runs 0. Check after test.
- GitHub secret only; serialized single-spec workflow after matching guarded Preview deploy. This is not member deactivation or account recovery QA.
