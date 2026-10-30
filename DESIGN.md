# OilStation Interface System

<!-- impeccable:design-system 1 -->

**Mode:** Operate. This is a work surface for station staff, not a promotional dashboard.

## Direction: clear operational ledger
Preserve OilStation's teal identity; emphasize staff decisions and verified records over decorative metrics. A consistent white and cool-slate canvas with teal only for the main action, selection, and genuine status. One task at a time. A station card should communicate *name, ownership, relevant enabled modules, available next actions* rather than fake KPIs.

## Tokens
- Canvas `#F5F7F8` and white `#FFFFFF`; sidebar `#F9FBFB`.
- Text `#1B3340`; secondary `#526A76`; light borders `#D8E2E7`.
- Primary `#08737A`; primary hover `#065A60`; light selected `#E5F2F0`.
- Danger `#B33B35`, error tint `#FFF1EF`; success `#13745A`, tint `#E8F5F0`; caution `#8B631A`, tint `#FFF5E1`.
- System-first Thai-compatible font stack. 15px body on desktop, 16px on phone. Data uses `font-variant-numeric: tabular-nums`.
- Spacing rhythm 4/8/12/16/24/32, card radius 10–12px, controls 8px.
- Clear 2–3px focus rings, not color-only state. 44px touch target.
- Screens are primarily flat surfaces with borders, not decorative glow or gradients.

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
