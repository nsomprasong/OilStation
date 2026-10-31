# OilStation Interface System

> **Current visual authority — LuxCart (1 November 2026).** Follow `docs/design/2026-11-01-luxcart.md` and last-loaded `public/luxcart.css`. Existing Gentelella color statements below are historical and no longer define the palette, typography, spacing, radius or icon treatment. All 31 October navigation semantics, Thai workflow accessibility, tenancy and financial correctness remain mandatory.

<!-- impeccable:design-system 1 -->

**Mode:** Operate. This is a work surface for station staff, not a promotional dashboard.

## Direction: Gentelella v4 — selected, canonical OilStation operational UI
Preserve OilStation's teal identity; emphasize staff decisions and verified records over decorative metrics. A consistent white and cool-slate canvas with teal only for the main action, selection, and genuine status. One task at a time. A station card should communicate *name, ownership, relevant enabled modules, available next actions* rather than fake KPIs.

## Approved navigation standard — 31 October 2026

**Latest authority overrides older mobile/desktop navigation instructions below.** There are only two persistent navigation surfaces: (1) a horizontal, one-row, overflow-scrollable contextual submenu of glossy 3D circular icons with small Thai captions directly under the Header on non-Home screens, and (2) a five-slot bottom navigator on mobile **and desktop**: Home + four most frequently selected authorized modules. The full role-filtered catalogue exists **only on Home**; no duplicate Home quick strip, desktop sidebar, drawer, top category stack, additional hamburger, or permanent scan action. Preserve exactly five visual slots; render unused slots inert for roles that have fewer than four other modules. Frequency counts are local to each signed-in user and cannot expand authorization. Submenus derive from the **actual functional cards inside the selected page**, not any cross-page task group. Only the selected card is visible at a time; the other cards stay mounted (state/form inputs preserved). A station/customer/invoice data-record card remains within its functional list, not an individual navigation item. This applies to Sales, Stations, Plans/VAT, Corporate, HR and all workspaces; safety-critical sequential Pump verification must remain together in one task pane. See `AGENTS.md` and `test/ui/navigation-standard.test.mjs`.

## Task-card submenu interaction (latest, 31 October 2026)

- Clicking **ทีมขายและค่าคอมมิชชั่น** in Home/dock opens that screen. Its submenus are **เชิญเซลล์**, **ทีมขาย**, **ปั๊มที่รับผิดชอบ**, **ย้ายการดูแล**, **ตรวจสอบปั๊ม**, **ลูกค้าที่ชำระแล้ว**, **ค่าคอมมิชชั่น**, **ประวัติการดูแล**. Show **one pane** at a time. A click on เปิดหน้าปั๊ม switches to the inspection pane automatically.
- Platform Billing submenus are **รายการแพ็กเกจ**, **เพิ่มหรือแก้ไขแพ็กเกจ**, **นโยบาย VAT**. Add/Edit must switch to the editor, Cancel/Save should return to the list; maintain the form and real validation.
- HR submenus are employees, schedules, replacements, overtime and review queues. Do not add a second local HR tab row. Corporate account and station customers likewise divide by functional task.
- Other single-workflow screens still have one header submenu, not each data item as a tab. Keep scanning, plate verification, fueling and receipt proof together rather than interrupting a safety-critical sequence.
- **Never replace/remount forms when changing tabs**. Use `hidden` on surrounding pane wrappers and maintain their live DOM. Scope role-dependent tabs to actual permissions; hidden admin-only operations must never become accessible from a client-only tab.
- Keep all two-level navigation rules in `AGENTS.md`; implementation is `src/client/functional-submenus.js` and final CSS `public/functional-submenus.css`.

## Tokens
- Canvas `#F5F7FB`, white `#FFFFFF`, dark navy accent `#1A2332`.
- Text `#1E2633`, secondary `#626D7D`, borders `#E6E7EB`.
- **Gentelella v4 teal `#1ABB9C`**, hover `#169F85`, active circular menu highlight and focus ring.
- Gentelella v4 compact radius 4 / 6 / 8 px for operation cards, with glossy 3D circular icons exclusively for navigation.
- Danger `#B33B35`, error tint `#FFF1EF`; success `#13745A`, tint `#E8F5F0`; caution `#8B631A`, tint `#FFF5E1`.
- System-first Thai-compatible font stack. 15px body on desktop, 16px on phone. Data uses `font-variant-numeric: tabular-nums`.
- Spacing rhythm 4/8/12/16/24/32, card radius 10–12px, controls 8px.
- Clear 2–3px focus rings, not color-only state. 44px touch target.
- Screens are primarily flat surfaces with borders, not decorative glow or gradients.

## Source of visual authority

The user selected **Gentelella v4** as the OilStation UI. This overrides prior generic light-sidebar and Impeccable aesthetic choices. Official upstream: https://github.com/ColorlibHQ/gentelella (MIT License; Colorlib). Reference v4 tokens and shell patterns in `src/scss/v4/_tokens.scss`, `_layout.scss`, `_components.scss`. Our client remains a permission-aware, Thai-first SPA shell, not Gentelella's 58 demo MPA pages. Do not copy demo data into the live app. `public/navigation-standard.css` is the final navigation override after the Gentelella visual layer; legacy styles are compatibility until later consolidation. Preserve design accessibility, financial truth, and UX hardening from Impeccable.

## Building blocks
`ws-screen` primary task surface; Home full menu, contextual menu below Header, and five-position frequent dock; `.field` visible form labels; `.button.primary` one primary action; `.notice` and `[role=status]` inline feedback; `.module-item` real server-backed record; `.hint` help not an alert; `os-state` semantic status.

## Interaction design
- Keep current work area while navigating; avoid resetting to Overview on reload if the same role still has access.
- No desktop sidebar, mobile drawer, extra hamburger or duplicate full menu. Home contains the full role-filtered list; non-Home screens have one horizontal contextual submenu below Header and a five-slot frequent dock.
- Async actions show in-progress feedback and disable double submission.
- Error message says what failed and the recovery. No generic `error` or misleading `success`.
- No fake payment success or generated account data.
- Operation-specific empty states include the user's next action, not an empty card.
- Long Thai labels wrap, prices align tabular right, and tables scroll within the viewport.
- Auth/accept-invite/owner-plan/station/fuel/HR/corporate screens share controls and status semantics.

## Boundaries
CSS is isolated to authenticated workspace or guest authentication; API validation, tenancy, signed coupon rules, financial accounting and background processing remain unchanged. No template copy or new runtime dependency.

## Mobile-first presentation — selected reference (30 October 2026)

The user provided a banking-style app screenshot as the **mobile information-architecture reference**, not as an authorization to copy its brand, exact orange palette, financial balances, icons or proprietary artwork. Preserve Gentelella v4 for desktop and OilStation teal + navy identity on mobile.

**On phone (up to 850 px):** full-width greeting + functional service search; one complete icon-based catalogue from the server-issued role screens; two truthful information cards (account access scope and count of accessible modules); an icon grid for all accessible features; persistent five-position bottom navigation (Home + 4 most-used authorized screens; unused slots inert). Scanner stays inside the authorized Pump workspace. There is no central Scan action and no More/hamburger. No fabricated wallets, points, balances, alerts or transactions.

**Scan behavior:** one tap navigates to pump workspace and opens the native rear-camera BarcodeDetector reader. Frame the QR, read it, then use the existing station-side server inspection; never skip authorization, license gate, plate evidence or supervisor approvals. Stop all camera tracks after scan, navigating away, canceling or backgrounding the tab. On unsupported browsers or denied permissions, explain the limitation and allow manual QR payload entry. Never claim a decoded QR is an approved or settled transaction.

**Desktop:** retains Gentelella-inspired cards but uses the same persistent five-position dock and under-Header contextual navigation as mobile, without sidebar. The mobile adaptation is in `src/client/mobile-home.js` and `public/mobile-app.css`. All feature labels and navigation keys come from `selectWorkspaceScreens` to reflect real roles. Reuse Lucide allowlist icons.

## Unified mobile screen system and power sign-out (approved 30 October 2026)

The user approved extending the *existing OilStation mobile home visual language* to every authenticated workspace screen, including pump QR, fuel configuration, attendance, approvals, corporate customers, finance, owner plan/VAT and staff. All non-home screens show one Header, one horizontal glossy circular sub-menu immediately below it, and the module's own work content. There is no second hero shortcut collection or stacked navigation; the five-position dock is shared by desktop and mobile. Related shortcuts come only from server-permitted screen descriptors, never client guessed roles. Preserve the module's exact fields, validation, server-backed statuses and functionality inside the new visual wrapper.

Replace the home hero's decorative O mark with a 46px accessible **Power** icon at the top-right. Activating it asks for confirmation and reuses the existing authenticated logout handler, which clears the last workspace and invokes Supabase sign-out. No alternative session logic or unsecured redirect is introduced. Keep focus indicators, reduced motion, 320px support and private-data safeguards.

## Unified mobile + desktop and progressive management (30 October 2026)

- User direction: all screens, including login, should carry the mobile OilStation teal visual language, and Desktop must be coordinated with the same palette while retaining Gentelella v4's compact spacing, forms and cards (not its former sidebar).
- Login is a concise, invite-only hero and provider card, with locally rendered true Google multi-color G and Facebook blue logo. OAuth redirect flow is not changed.
- Record first: list of station/fuel/plan records appears as cards. The lower-right pencil is available only when the existing API supports a genuine edit action (fuel prices and VAT); unsupported edits must **not** pretend to persist. Existing delete/approval buttons keep their meaning.
- Progressive forms: on authorized stations, HR, customers and SaaS billing creation screens, the existing create form starts closed and appears only after tapping + above mobile bottom nav. On desktop use an accessible floating create control as well. Do not hide scanner, safety evidence, payment, approval or other critical verification flows.
- One contextual group under the Header containing only the current authorized task group's screens. Home hides this group. Never render all categories in stacked columns.
- All errors, pending states, monetary records and role checks remain real, and incomplete forms retain their input values on errors.
- Final CSS order: existing styles -> Gentelella v4 -> Mobile App -> unified design -> navigation-standard.css last. New design only creates presentation elements and defers form visibility, never mutates API outcomes.
- Manual QA required on authenticated Android and Desktop for layout, keyboard, 200% zoom, top tabs, create FAB, card edit and error recovery. Automated tests are not sufficient to claim screenshots are perfect.

## Gold 3D brand logo (approved 30 October 2026)

The user-selected transparent gold 3D oil-drop and fuel-nozzle emblem is the single canonical OilStation application logo. Source-of-truth: `public/oilstation-gold-logo.svg` embeds a compact optimized transparent bitmap derived from the supplied generated PNG. Node prebuild/predev materializes a standalone browser-compatible PNG `public/oilstation-gold-logo.png` for favicon and iOS home-screen icons. Use the SVG master for login, public header, desktop toolbar, and mobile Home. Preserve OilStation text beside the emblem where the interface needs a text label; do not alter or overlay wording on the emblem itself. The source artwork has no background and no lettering. Do not replace it with a CSS-generated O, and avoid external image CDNs.
