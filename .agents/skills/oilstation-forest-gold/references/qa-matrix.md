# Full visual QA and UI-parity matrix

This skill preserves the **source design contract**. Real pixel parity requires a screenshot and computed-style check of the currently deployed code with an allowed test account. A GitHub docs-only review is not a substitute for that browser step.

## Viewport / interaction matrix

| Width or scenario | Verify |
|---|---|
| Desktop 1440px | 248px sidebar, sticky green toolbar, contextual task tabs, one title, aligned balance-card grid, side gutters and 1px gold trim |
| Desktop 1280px | no horizontal page overflow; credit/profile/logout all visible; sidebar remains role-filtered |
| Tablet 1024px | two-column operational forms where permitted; driver roster stacks at <=960px, not 1024px |
| Transition 960px | driver form/roster becomes single column; no column clipping |
| Transition 850px | desktop sidebar hidden; mobile dock visible; toolbar keeps credit + profile same row |
| Transition 680px | corporate coupon form becomes one column |
| Phone 390px | tab row scrolls inside itself; profile and credit readable; CTA stays above dock |
| Phone 360px | no viewport sideways scroll or clipped money; form input and labels usable |
| Phone 320px | username retained in reasonable abbreviated form; safe-area/dock not covering submit |
| Zoom 200% | content reflows, tables scroll inside wrapper, actions remain keyboard reachable |
| Mobile landscape/keyboard | active input visible, overlays don't cover action, no fixed footer clipping |
| Reduced motion | no essential entrance animation or hidden content |
| Keyboard only | logical sequence sidebar/dock → task tabs → headings → inputs → CTA; visible focus |
| Long Thai labels/currency | wrapping/ellipsis only on noncritical copy, amount accessible in full |

## Component checklist for each screenshot

Record the target width and the following **computed**, not guessed, values:

- Shell: sidebar width, main horizontal padding, toolbar height, title placement and one-tab-row count.
- Surface: background colours, gradient angle/stops, line thickness, opacity, computed border radius, inset from outer card.
- Cards: grid column count, min-width, gap, padding, header/body/footer slots, record spacing.
- Buttons: line-height/height, padding, primary/secondary/destructive states, hover/focus/disabled/loading.
- Financials: tabular numeral glyphs and Baht units, right alignment, readable large balance; no invented data.
- Search/table: exactly one search field when the flow requires it, embedded magnifier, table-local overflow.
- Mobile nav: exactly five positions, centered and evenly distributed, no imaginary links, active orb contrasted.
- Form state: switch task tabs and come back, values preserved; disabled/unavailable actions correctly explained.
- Gold accent: decorative pseudo-elements below text, pointer-events:none, no clipping of popover or tabs.

## Corporate role/state matrix

| Role / task | Important evidence |
|---|---|
| Company Admin | only authorized tasks, credit reflects actual account, assigned vehicle/driver controls conditional |
| Company accountant | no unauthorized driver assignment/coupon issuance, real financial details read/submit based on role |
| Authorized coupon issuer | usable driver selection, read-only plate, real reservation preview, issue result only after success |
| Driver-only | no header credit leak; assigned QR in driver workspace per role |
| QA-only topup | clearly simulated; can't be confused with real bank transfer |
| Station owner / customers | separate station-side tabs, linked corporate credit, proper pending approval |
| Empty account | helpful 'not linked' message, no fabricated 0.00 |
| Error from API | actual failure text/recovery, no false green success |
| Pending slip or pending QR | pending distinct from approved/completed |
| Long reports | filter by plate, correct completed-fills only, local horizontal table scroll |

## Suggested screenshots (authorized non-sensitive QA identity only)

- login-desktop.png, login-mobile-390.png
- customer-account-desktop.png, customer-account-mobile-390.png
- customer-topup-desktop.png, customer-topup-mobile-390.png
- customer-drivers-desktop.png, customer-drivers-mobile-390.png
- customer-coupon-desktop.png, customer-coupon-mobile-390.png
- customer-report-desktop.png, customer-report-mobile-390.png
- station-customers-desktop.png, station-customers-mobile-390.png
- profile-menu-mobile-320.png, mobile-dock-360.png, empty-account.png, api-error.png

Keep screenshots out of public version control if they expose names, identifiers, money, QR payloads or other private data; use isolated synthetic authorized QA fixtures where allowed. Document which screens were actually captured. Until then, call the skill a **source-derived design reference**, not pixel-perfect visual QA.

## Definition of Done for future implementations

1. All requested UI components use one semantic token hierarchy, with no duplicate CSS cascade.
2. Actual rendered screenshots reviewed across the relevant widths and against approved source.
3. All roles see only authorized navigation/actions; menu state, form preservation and statuses tested.
4. Money, top-up approval, QR issuance and reports remain real and unchanged.
5. No global CSS regression, missing font, inaccessible 320px control or misaligned gold overlay.
6. Tests/CI logged; only claim pass/deploy/merge for runs actually verified.
