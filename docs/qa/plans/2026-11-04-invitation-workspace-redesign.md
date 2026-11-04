# OilStation invitation UI release plan — 2026-11-04

## Scope / owner authorization
Redesign only the `invitations` workspace in the **existing production application**. No schema, Auth, RLS, worker API, wallet, payroll, billing, or financial flag changes. Owner approved implementation and production deployment of the professional green/cream membership screen.

## Grounded findings
Old `createInviteControl` displayed its toggle plus nested form, `mountQaAccountsAdmin` always showed a second card/form, `functional-submenus` added a redundant one-item tab, and `progressive-workspace` generated an additional floating invite button. They were simultaneously visible in desktop screenshots. **There is no existing scoped directory listing API** for all company members. To avoid fabricating data or broadening permissions, the new list displays **only server-confirmed invitations/accounts created during the current browser view**, explicitly says it is not the company directory, and keeps a clear empty/search state. The current invitation-link creation and QA account creation APIs are unchanged.

## Acceptance
- One title `จัดการสมาชิก`, one primary `เพิ่มสมาชิก` action, no single-item contextual tab or floating invitation FAB.
- First visit displays readable session-only recent records/empty state, not a full-height form.
- Desktop opens a cream/right drawer (~560px); mobile at 320/360/390px opens full-height; Escape/backdrop/close/cancel return to list and native dialog focus behavior is retained.
- Permission-filtered tabs: real email invite always where allowed; QA tab only when original QA mode and authenticated QA identity authorize `mountQaAccountsAdmin`; Sales read-only sees no create buttons.
- Normal and QA forms preserve original validation, role/scope dropdowns, server 403/validation handling. No silent send, no fake member or email-delivery status. A new invite link stays visible for copying after success.
- On server-confirmed result, add only the supplied alias/email and permitted role to this view; never show any password or private URLs in recent list.
- Browser layout checks: 320, 390, 1024, 1440. Keyboard tab and arrow keys, role separation, search and no body overflow. No finance/payout operations.
- Regression: Node tests and CSS audit/build, protected GitHub Actions local Chromium and production anonymous smoke. Authenticated production creation/role-scoped browser check is **NOT TESTED** unless actual credentials and protected browser workflow execute; do not claim pass by running DOM fixtures.
- Deploy: merge PR only after CI succeeds and validate GitHub Actions Production Preview and Cloudflare Worker version; maintain `OILSTATION_API_ENABLED=false` and finance flags.

## Data safety
No synthetic records or DB mutation in tests. Local Chromium component fixture records are in browser memory only and not sent to live endpoints. No cleanup required, baseline payroll/finance untouched.
