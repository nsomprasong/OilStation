# Midnight Banking — OilStation design authority (1 November 2026)

The user's reference is a dark, premium financial dashboard. OilStation adapts **its visual language and desktop information architecture** without adopting a banking product, fictional amounts or fabricated charts.

## Canonical tokens
- Page: `#040D3F`; sidebar/header: `#141C4E`; cards: `#1D2552`; hover: `#243066`.
- Primary text white, secondary text `#B9BBC7`; muted `#8994B2`.
- Action cyan `#0D8091`; positive mint `#7FE089`; negative coral `#F97D7D`.
- Inter + Noto Sans Thai; JetBrains Mono for financial numbers, with tabular numerals.
- 8px rhythm, 12px cards, 16px prominent cards, 8px compact buttons.

## Desktop architecture
- Left sidebar, 224px, persistent and scrollable, derived **only from `selectWorkspaceScreens()`**, with an actual active state and role-safe destination buttons.
- Main panel expands to the viewport's remaining width. Header toolbar contains OilStation branding, functional authorized-menu search and sign-out.
- Overview has a concise title, three-column authorized task grid and truthful scope/module summaries. **Never fabricate balances, accounts, cashflow charts or transactions from the reference image.**
- Non-Home screens preserve horizontal functional submenus under the header. Data/forms stay mounted when panes change.
- Five-position bottom dock remains **mobile-only**, retaining per-user frequency and permission filtering.

## Safety and validation
Keep real Thai wording, all financial and HR semantics, role-based authorization, safe areas, focus states and print readability. One stylesheet only: `public/oilstation.css`. Screenshot/Chromium checks must cover desktop at 1230/1440 px, mobile at 390px, login and seven distinct role shells. `npm run check` audits the stylesheet architecture.
