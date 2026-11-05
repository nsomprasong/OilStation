# Corporate/customer work screens — approved OilStation reference

Source: src/client/workspace-layout.js, src/client/functional-submenus.js, src/client/toolbar-credit.js, src/client/user-profile.js, src/client/station-customer-reports.js, public/oilstation.css. This reference captures **the screen used by a customer company of a petrol station** and shared layout motifs; it is not a database schema or a screenshot of production data.

## Page shell

- Cream-to-sage gradient canvas. On desktop, dark forest permission-filtered left sidebar and compact dark top toolbar.
- Header uses a deep emerald gradient and subtle gold arc / bottom rule. Avoid duplicate headings: the corporate pane's selected functional task owns the title, so the redundant global scope heading is suppressed.
- Directly under the top header, one horizontal row of contextual **functional** tabs (not every individual record as a tab). Green gradient active pill; other tabs quiet/light; on phone allow horizontal scrolling.
- **Only one active task pane**. Inactive panes stay mounted but hidden to preserve unsaved input and active workflows. Navigation never bypasses permission enforcement.
- The work card uses cream surface, thin neutral border, 16px radius, inset card 12px radius, 8px gutter, no piled-up heavy shadows.

## Actual tasks (only when permitted and present)

1. **บัญชีบริษัท** — account relationship and available credit. Large green tabular amount, supporting reserve/debt/transaction details shown truthfully, bank transfer status clearly distinguished. Credit cards can use a thin gold top border. No invented balance.
2. **แจ้งเติมเงิน** — actual bank transfer instructions, upload slip and pending approval status. A submitted slip does **not** imply approved credit.
3. **เติมเงินทดสอบ** — a separate **QA-only** path, clearly marked simulated and never mistaken for a real bank transfer.
4. **รถและคนขับ** — registered plate / assigned driver and eligible vehicle controls; clear record actions and real validation. Photo-only plate evidence where required; never claim OCR verification.
5. **ออกคูปอง** — two-column desktop form, single-column mobile; station/fuel/driver/vehicle, limit and expiry, real validation and distinct reserved vs actually used credit. Main issuance action at form end, not repeated on every card.
6. **รายงานเติมน้ำมัน** — true settled/completed fills, scoped to the selected corporate, plate filter, compact summary, table with dates, vehicle, volume, amount; tabular numbers and horizontally scrollable table on phone. A reserved coupon is not a completed fill.

Station-side customer management is a separate permission scope (credit, open corporate account, link existing company, completed-fuel report) but uses the same card, filter and table grammar.

## Toolbar — modern compact pattern

- On desktop, show scoped available credit, signed-in profile and icon logout in top toolbar.
- Mobile: **credit amount and user profile on the same horizontal toolbar row**; no separate refresh button. For accounts eligible to see balances, show read-only refresh on foreground/navigation and periodic automatic refresh. Never display a corporate balance to driver-only membership.
- Current OilStation implementation refreshes on mount, at 60-second polling while visible, and on foreground/screen change if 30 seconds stale. Use actual API policy when adopting elsewhere; do not promise instantaneous values.
- Profile trigger shows user avatar initial/name and a contextual popover (name, email, granted role). Username is display info only, not authorization.
- Icon-only logout has accessible label, minimum useful touch target and confirmation.
- Customer directory search: **one search field** for name/email/role with magnifier action inside the input; no separate duplicate large Search button. Leave breathing room below sticky toolbar.

## Forms, tables and feedback

- Compact labels ~12–13px, >=44px controls, accurate placeholder examples, related fields in groups.
- One operational primary button, subtle secondary actions, destructive controls explicitly distinguished.
- In-card status explains loading, pending, approved, rejected, failed, empty and retry. Never collapse pending into success.
- Money: display correct currency unit, decimals from source, right-aligned tabular numeric columns. Truncate long labels without cutting off meaningful values.
- Tables scroll inside bordered containers, never force viewport horizontal overflow.
- Evidence photos/slips stay uncropped in inspection view; required checks remain in the same task flow.
- Thai labels can wrap, focus is visible, every selected tab has aria-pressed/aria-current or a semantically equivalent state.

## Phone and tablet

- At <=850px remove desktop sidebar, keep compact toolbar, bottom **five visual slots** (Home and up to four frequently used permitted modules). Center and evenly distribute available destinations. Empty positions remain inert.
- Content becomes one column; contextual tabs scroll horizontally; dock and safe-area padding protect final form actions.
- At <=480px compact toolbar labels but do not hide the user's name entirely when it would break identity clarity. Profile and credit stay readable together.
- Avoid duplicate global navigation rows, giant stacked quick-link cards and unrelated panes on a single scrolling screen.

## Do not copy product logic

The visual pattern is reusable; **roles, tenants, credit balances, ledger rules, coupons, top-up approval, reporting endpoints and user data are not**. In another project, replace all OilStation workflows with the real target application's domain and permissions. If copying into OilStation itself, never redesign a proof-sensitive pump or payroll workflow into multiple unsafe disconnected steps.
