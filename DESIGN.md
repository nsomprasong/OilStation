# OilStation Interface System

<!-- impeccable:design-system 1 -->

**Mode:** Operate. This is a work surface for station staff, not a promotional dashboard.

## Direction: Gentelella v4 — selected, canonical OilStation operational UI
Preserve OilStation's teal identity; emphasize staff decisions and verified records over decorative metrics. A consistent white and cool-slate canvas with teal only for the main action, selection, and genuine status. One task at a time. A station card should communicate *name, ownership, relevant enabled modules, available next actions* rather than fake KPIs.

## Tokens
- Canvas `#F5F7FB`, white `#FFFFFF`, **dark navy sidebar `#1A2332`**.
- Text `#1E2633`, secondary `#626D7D`, borders `#E6E7EB`.
- **Gentelella v4 teal `#1ABB9C`**, hover `#169F85`, active sidebar overlay `rgba(26,187,156,.08)`.
- Gentelella v4 compact radius 4 / 6 / 8 px, 252 px standard sidebar and 68 px rail mode.
- Danger `#B33B35`, error tint `#FFF1EF`; success `#13745A`, tint `#E8F5F0`; caution `#8B631A`, tint `#FFF5E1`.
- System-first Thai-compatible font stack. 15px body on desktop, 16px on phone. Data uses `font-variant-numeric: tabular-nums`.
- Spacing rhythm 4/8/12/16/24/32, card radius 10–12px, controls 8px.
- Clear 2–3px focus rings, not color-only state. 44px touch target.
- Screens are primarily flat surfaces with borders, not decorative glow or gradients.

## Source of visual authority

The user selected **Gentelella v4** as the OilStation UI. This overrides prior generic light-sidebar and Impeccable aesthetic choices. Official upstream: https://github.com/ColorlibHQ/gentelella (MIT License; Colorlib). Reference v4 tokens and shell patterns in `src/scss/v4/_tokens.scss`, `_layout.scss`, `_components.scss`. Our client remains a permission-aware, Thai-first SPA shell, not Gentelella's 58 demo MPA pages. Do not copy demo data into the live app. `public/gentelella-v4-selected.css` is the final canonical visual layer; legacy styles are compatibility until later consolidation. Preserve design accessibility, financial truth, and UX hardening from Impeccable.

## Building blocks
`ws-screen` primary task surface; `ws-nav` grouped role-aware navigation; `.field` visible form labels; `.button.primary` one primary action; `.notice` and `[role=status]` inline feedback; `.module-item` real server-backed record; `.hint` help not an alert; `os-state` semantic status.

## Interaction design
- Keep current work area while navigating; avoid resetting to Overview on reload if the same role still has access.
- Desktop sidebar stays visible; mobile drawer traps keyboard focus when open, closes on Escape/backdrop and restores focus.
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

**On phone (up to 850 px):** full-width greeting + functional service search; four icon-based fast actions from the server-issued role screens; two truthful information cards (account access scope and count of accessible modules); an icon grid for all accessible features; persistent five-position bottom navigation, with a raised central QR scan button. The center scan is only enabled for members authorized for the station pump module. More opens the existing accessible sidebar. No fabricated wallets, points, balances, alerts or transactions.

**Scan behavior:** one tap navigates to pump workspace and opens the native rear-camera BarcodeDetector reader. Frame the QR, read it, then use the existing station-side server inspection; never skip authorization, license gate, plate evidence or supervisor approvals. Stop all camera tracks after scan, navigating away, canceling or backgrounding the tab. On unsupported browsers or denied permissions, explain the limitation and allow manual QR payload entry. Never claim a decoded QR is an approved or settled transaction.

**Desktop:** stays on Gentelella v4 grouped sidebar and conventional workspace, with no bottom bar. The mobile adaptation is in `src/client/mobile-home.js` and `public/mobile-app.css`. All feature labels and navigation keys come from `selectWorkspaceScreens` to reflect real roles. Reuse Lucide allowlist icons.
