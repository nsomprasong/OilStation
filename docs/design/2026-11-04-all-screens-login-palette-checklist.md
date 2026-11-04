# OilStation — All Screens UX/UI Renovation Checklist
**Latest approved visual target:** OilStation login's emerald green / warm cream / restrained gold, applied to every role-scoped workspace page on desktop and mobile.  
**Inventory date:** 2026-11-04. **Status:** Specification only; this document does not change runtime CSS, pages, user privileges, QA data or production behavior.  
**Implementation authority:** `src/client/workspace-layout.js`, `src/client/functional-submenus.js`, `src/client/mobile-home.js`, `src/client/main.js`, `src/client/auth-screen.js`, `public/oilstation.css`.

## Context and source of mismatch

The authentication UI currently defines `--auth-forest:#10271e`, `--auth-deep:#0c1d17`, `--auth-cream:#eae7df`, `--auth-ink:#1b2a24`, `--auth-muted:#67736b`, and `--auth-gold:#bd9a5e` inside `.os-auth-shell`. However, global `:root` in `public/oilstation.css` still uses midnight blue tokens such as `--os-bg:#060F33`, `--os-side:#040B28`, `--os-card:#0E1B47`, `--os-ac:#2BB6C9`, `--os-gold:#E8B84A`. Login looks green/cream; the workspace looks navy/cyan.

The owner has selected **login green/cream/gold** for **ALL** pages, superseding the historical Midnight Banking palette. Preserve Midnight Banking's *functional architecture* (desktop persistent permission-filtered sidebar and role-scoped workspace, contextual functional submenus and mobile five-slot dock) but replace its blue/cyan *styling* everywhere. Align `AGENTS.md` and `docs/design/css-architecture.md` with this approved change in the implementation PR so future edits do not reinstate the obsolete palette. Avoid treating an AI-generated image as executable source or as proof of UI completion.

## 1. Locked visual tokens and shared components

| Layer | Target | Required adjustment |
|---|---|---|
| Sidebar/topbar | Forest `#10271E`; deep `#0C1D17`; muted emerald `#194635` | Consistent background, brand mark, readable cream labels; subtle gold 1px divider |
| Page background | Warm ivory `#EAE7DF` or a lighter warm-ivory step | Replace midnight navy page surfaces while keeping a green outer shell |
| Card / form surface | Warm off-white, e.g. `#F7F5EF` (new design token) | Restrained border and rare low shadow, not nested dark blocks |
| Primary text | Dark-ink `#1B2A24`; muted `#67736B` | Thai labels legible on cream, numerical amounts use tabular numerals |
| Gold accent | `#BD9A5E` | Breadcrumb/kicker, small rule, controlled selected edge; no decorative overuse |
| Primary action | Deep emerald `#194635` with cream text | Same visible hover, focus, loading, disabled states |
| Active sidebar | Cream background + deep green text | Current tab unmistakable without cyan fill |
| Active subtab | Green fill + cream text; inactive = green-outline on cream | Under header; only the pane chosen is visible, keep hidden form values |
| Danger / warning / success | Accessible semantic tones, legible text and icon + label | Never use green alone as the only approval indicator |
| Forms | 44–48px min controls, 12–14px radius, clear focus ring | Label above input, correct inputmode, error under the field |
| Data tables | Cream, hairline row dividers, aligned amounts | Mobile scroll inside the table only; no body horizontal overflow |
| Overlays | Cream modal/drawer, readable backdrop, sticky actions | Keyboard trap, focus restore, explicit cancel and confirmation |
| Global | 8/12/16/24/32px spacing scale and consistent font | Real business data only; no fictitious KPI, price or approval status |

**One CSS authority:** Edit `public/oilstation.css` in place; map `--os-*`, legacy `--mid-*`, `--oil-*`, `--gt-*` aliases consistently. Do **not** add a new theme file, a second `:root` override at the bottom, `!important` cascades as a blanket fix, or destroy business module styles. Refactor the owning selector for controls/cards/tabs and remove *superseded* conflicting definitions with regression tests. The login and workspace should use one shared brand token source, with limited auth-layout-specific exceptions.

**Functional shell rules:** Preserve filtered desktop sidebar, contextual submenu directly below top header, a single active task pane rather than stacked cards, Home's complete eligible task catalog, and mobile bottom nav exactly five slots (Home + up to four frequently used permitted pages). Do not reveal hidden modules because of CSS `display` changes. Do not replace task sections with static screenshots.

## 2. Screen-by-screen scope — 18 primary workspace keys

Legend: P0=shared structure and photographed pages, P1=high frequency or financial workflows, P2=secondary/administrative. These are the exact `selectWorkspaceScreens` keys in `src/client/workspace-layout.js`; page visibility depends on membership.

| Priority | Screen / workspace key | Subscreens and what to change | Key UI acceptance |
|---|---|---|---|
| P0 | **Overview `overview`** | Replace midnight KPI/quick-launch tiles with warm cream task cards, elegant responsive 3-column desktop layout; keep scope and module information grouped separately; green title and gold eyebrow | All eligible actions findable, no invented KPIs, no inaccessible menu |
| P2 | **Platform support `support`** | Read-only station statuses/history in a legible cream listing, filters/search and muted no-access/empty states | Read-only status distinguishable, no edit CTA |
| P1 | **Sales team & commission `sales`** | Four actual subtabs: Team, Assigned stations, Transfer/assignment history, Commissions. Compact cream member and station cards, readable money/date columns, one action per pane | No cross-station role leakage, sales permissions unchanged |
| P2 | **Activity / audit `activity`** | Event table with actor, station, time, action; cream filters/search, restrained state chips; expandable details for long rows | Audit data preserved, mobile overflow localized |
| P1 | **Station creation / directory `stations`** | Tabs: Create station, Directory, Set fuel. Stepwise station onboarding, company info card, module entitlement display, station list cards; green CTA, no giant stacking of forms | Sales opens only stations allowed, owner controls respected |
| P1 | **Station SaaS plans `plan`** | Package comparison, selected HR/QR modules, month/year billing, card/QR method with plain terms; cream pricing cards, one highlighted option | No premature 'paid' state or automatic card charge |
| P1 | **Platform billing & VAT / organization billing `billing`** | Platform tabs: Package list, add/edit, VAT policy; organization invoice/dues/payment history. Amount, fee and 2% transfer discount displayed as data, not decorative buttons | Monetary signs, currency, due date and approval state remain precise |
| P1 | **Station fuel catalogue `fuel`** | Fuel type editor, pump price table, effective date scheduling, corporate special prices; gold microaccent for published price; clear scheduled-vs-live labels | Never invent price or silently apply draft as current |
| P1 | **Pump / scan `pump`** | Large scanning target, camera/photo feedback, plate/receipt photo cards, coupon eligibility, reserved amount and actual fill summary; high-contrast one-step confirmation | Real QR, amount and photo state; block invalid/used coupon |
| P1 | **Station corporate customers `customers`** | Two tabs: Open new corporate account, Link existing company. Clear tenant relationships, bank/credit rules, short stepper, effective relationship cards | Station–corporate multi-tenancy preserved |
| P1 | **Station finance `finance`** | Pending top-up slip review queue, slip/photo viewer and controlled Approve/Reject; compact bank and debt records, readable evidence/invoice status | Approval never implied by upload; no direct ledger manipulation from UI |
| P1 | **HR employees/shifts `hr`** | Nine tabs: Employees; Identity & GPS; Payees & advances; Leave; Shift schedules; Shift substitution; OT request; Pending OT; Pending approvals. Group related forms; attendance and policy status in compact cards. Payroll/bank actions remain gated | Authorized managers alone approve; QA and actual payee actions cannot bypass current API gate |
| P1 | **Employee time-clock `attendance`** | Clear IN/OUT actions, shift and date, GPS permission and distance feedback, break/dual-shift awareness, success/denial detail | No fabricated clock-in, device-time and timezone correctness |
| P1 | **Attendance approval `reviews`** | Pending list with employee, shift, source, day, differences, approval/rejection reason and confirmation; no ambiguous green-only status | Only review-able records affected; audit trail preserved |
| P1 | **Payroll review preview `payroll`** | Period selector; salary readiness; attendance/OT/leave, advances, taxes/social security, bank payees; one problem/approval state per row, totals aligned and explicit 'preview only' when gated | Never show pay-ready until reviewed evidence, policies and financial gates pass |
| P0 | **Corporate workspace `corporate`** | Five tabs: Company balance/account, Real transfer slip, QA top-up simulation (QA-only), Vehicles & drivers, Issue coupons. Redesign attached screenshots: balance card, driver/plate mapping, coupon form field rhythm; distinguish real from QA credit | Scope to corporate, QR reservation/deduction remains server-side, QA label obvious |
| P1 | **Driver QR wallet `driver`** | Prominent active QR, linked plate, station eligibility, amount/coupon expiry, no-QR or expired placeholders, fuel history; phone-first presentation | QR cannot be redeemed twice, no fake active token |
| P0 | **Member invitations `invitations`** | Clear permission-scoped invitation wizard, QA account creation panel, role and organization/station selectors, one bottom-right add affordance; avoid clipped header and repeated nested panels in screenshot | Invite only eligible tenants, 'QA' visibly identified, 8-character rule only for existing sample reset |

**Subscreen examples are based on** `src/client/functional-submenus.js`; never invent nonexistent tabs. Conditional tabs (QA top-up, fuel editor, company access) appear only when their actual widgets and permissions exist.

## 3. Authentication, entry and overlay flows outside the 18 screens

| Flow | Target redesign |
|---|---|
| **Login / OAuth / QA login** | Keep approved split forest hero + cream form, real Google/Facebook logos, QA username/password controls and precise inline errors. This is the **visual reference**, not a feature redesign. |
| **Invited-user / token callback** | Apply same green/cream/gold scheme to invitation confirmation, expiry, rejection, OAuth callback, existing-account claim and missing-eligibility states. |
| **First administrator setup** | Same auth shell; one compact step at a time, real validation and a visible way back. |
| **Unauthorized / 404 / service error** | Same card and typography, one clear recovery action. Never imply absent permissions can be self-enabled. |
| **Logout confirmation** | Cream dialog with readable destructive/cancel contrast and focus handling; preserve return destination semantics. |
| **Global loading / empty / success / failure / confirmation** | Shared component style, legible status text, no spinner forever, appropriate action or retry. |
| **QR / photo / image / file preview dialogs** | Full evidence/image view with no crop of plate, receipt or slip; close/zoom keyboard and touch support. |
| **Invitation/account/vehicle/price/payroll detail drawers** | Reuse same overlay shell and role checks, responsive width and sticky actions. |

## 4. Desktop, tablet and mobile acceptance

| Width | Checklist |
|---|---|
| 1440 and 1280px desktop | Sidebar stable, search not overlapping logout, one active contextual tab, normal content max width, actions in viewport, aligned table amounts. |
| 1024 / 850px boundary | Form/card columns collapse intelligently without unlabeled icon-only destructive controls; no sidebar/content overlap. |
| 768 / 390 / 360 / 320px phones | Sidebar hidden; exactly 5 mobile dock slots; content single-column; fields and buttons full-width where useful; contextual tabs horizontally scroll inside container; sticky buttons avoid dock and safe-area insets; no viewport horizontal scrolling. |
| Portrait/landscape/zoom | Screen remains usable at 200% zoom, software keyboard and safe-area; print/receipt/export document styles do not inherit dark backgrounds. |
| Accessibility | Text contrast >=4.5:1 for normal body, clear focus, semantic input help/error, aria-current and aria-pressed, no motion dependency, no icon-only success/approval. |

## 5. Implementation order and concrete engineering changes

**Phase A — freeze shared architecture (P0).** Compare login palette tokens with existing `:root` + legacy aliases. Update approved design authority in `AGENTS.md` and historical design notes. Edit `public/oilstation.css` in place: global tokens, body, sidebar/topbar, page shells, shared cards/forms/buttons/tabs/tables/modals; do not append override layers. Test login, overview, authenticated desktop and mobile first.

**Phase B — photographed corporate flows (P0).** Fix attached screenshot pain points: tab pill active design, balance card, vehicles/driver binding and coupon input form. Keep exact account names, fuel prices, balance and QR eligibility supplied by API. Then invitations/account creation. Verify `c01-admin`, `c01-driver`, station and Sales roles independently.

**Phase C — all 18 screens (P1, then P2).** Apply shared component selectors to every corresponding module, then adjust the module's actual content (tables, side panels, cards, forms, real states). Do not touch SQL RPC permissions, calculation logic or payment secrets for presentation. Annotate intentional differences for pump/driver camera flows and payroll review.

**Phase D — production-safe QA and release.** Run `npm run check`, `npm test`, selected `test/ui/navigation-standard.test.mjs` and `test/ui/functional-submenus.test.mjs`, Playwright on 1440/1024/390/360/320, protected GitHub Actions checks and real production browser screenshots after approved deploy. Compare screenshots to login palette and supplied corporate pages. Verify old CSS conflicts removed, no overflow, all controls interactive and no restricted menu newly visible. Capture evidence for at least role groups: platform, sales, organization, station owner, station cashier, station HR, company admin, company issuer, company driver.

## 6. Acceptance / Definition of Done

- [ ] Every one of the **18 primary workspace keys** and the auth/invite/error variants uses the approved green/cream/gold visual system on desktop and mobile, including *lazy-loaded* cards and expanded forms.
- [ ] New design is implemented in existing canonical `public/oilstation.css` with one coherent token map; no extra stylesheet or last-page overrides.
- [ ] Desktop sidebar, contextual functional subtabs, mobile five-slot dock and per-role menu filtering still meet project tests.
- [ ] All 98 QA identities are **test cases only**; they are not blanket admin accounts. Only allowed data/actions display per role.
- [ ] A coupon price, balance, QR, wallet entry, payroll status, transfer approval and salary total show only actual API data.
- [ ] Modal, form, loading, no-data and error states match design; keyboards, zoom, small phones and focus navigation work.
- [ ] No finance or payroll release gate or business SQL privilege is relaxed by CSS/UX changes.
- [ ] CI, real-browser visual QA and production post-deploy behavior checks are recorded; only then claim implementation complete.

**Explicit nonclaim:** This document is a planning/checklist artifact. It is NOT evidence that all screens have been restyled or deployed.
