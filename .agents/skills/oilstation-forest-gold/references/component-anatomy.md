# Component anatomy — complete customer workspace pattern library

**Nature of this document:** CSS/DOM source-derived inventory, extracted 2026-11-05 from OilStation main. Values marked **current** describe defined rules in public/oilstation.css, and require browser verification for final cascade/computed dimensions. Values marked **recommended reusable** are normalized design choices for new projects. These are not pixel measurements from screenshots.

## Surface hierarchy (outer to inner)

1. Page ground = warm ivory/sage gradient; no white full-screen slab. Current corporate DOM order: toolbar → contextual tabs → selected-task green page header → active pane.
2. Green structural shell = sidebar/toolbar and task page header, with thin gold sweep.
3. Functional surface = one active task panel for the selected contextual menu; avoid nesting every independent form in one long column.
4. Card = quiet cream/ivory rounded rectangle, neutral border, slight or zero shadow.
5. Inset record = another surface inside the active card, inset 8px and usually 12px radius; do not place a card flush against its outer border.
6. Metadata = quiet text, compact secondary details; only money/next action needs prominence.

**Card anatomy:** [optional eyebrow / category] → heading → supporting sentence → primary datum / form / table → divider or status → bottom action row. Do not create a decorative header if it repeats the page header. A card's title is content, not an additional top-level navigation item.

## Detailed component registry (source selectors, current geometry, reuse)

| ID / component | OilStation source selectors | Current source-defined measurements | Recommended reusable meaning |
|---|---|---|---|
| C01 Outer task panel | .panel, .ws-widget>section, .os-functional-pane | .panel radius 16, padding clamp(18px,2.4vw,28px); several operational sections are later constrained to 14px radius / 20px padding with !important | One task context; preserve its forms while hidden |
| C02 Dark page-heading panel | .ws-screen-head and pseudo-elements | margin 20px 0 18px, padding 20px 24px, radius 16px, green gradient, gold sweep; corporate is tighter: margin 12px 0 14px, padding 18px 22px | One title + short description per task |
| C03 Page-header gold accent | .ws-screen-head::before/::after, .ws-toolbar::before/::after | soft curved gold radial trace + thin horizontal 1px fade, pointer-events:none | Only on green structural regions, beneath text |
| C04 Balance / wallet card | .account-overview, .balance-card, .balance-card .money | grid min 280px, gap 12px, outer margin 12px 0; card radius 12, padding 18, gap 7, gold top border 2px; money 25–32px | Station/company, true available amount, one optional verification control |
| C05 Credit summary banner | .os-credit-banner | margin 10px 0 14px, padding 12px 16px, radius 16px, left green rule 4px; muted green fill | Short real available-credit summary above account list |
| C06 Station credit details card | .os-credit-grid, .os-credit-account, .os-credit-detail | grid min 260px/gap 12px/padding-inline 8px; account pad 18px, radius 12; value 23–29px; detail divider margin-top 17/padding-top 15, row-gap 9 | Detailed financial rows, amounts in tabular numerals |
| C07 Record/list item | .module-item, .os-record-card, .os-editable-card | base pad 14px 16px, with later operational overrides (8 or 14px radius depending cascade); cards with inline edit reserve bottom space | Read-only or editable data, never unrelated task navigation |
| C08 Driver and vehicle assignment | #company-driver-workspace, >form, >.module-list | desktop: 1fr + 225–280px, gap 12px 18px; form padding 18px/gap 14; roster gap 10; <=960px one column | Form on left, roster on right; on smaller layouts stack |
| C09 Coupon issue form | #corporate-workspace #coupon-form | 2 equal columns; gap 14px 18px; pad 20px; radius 16px, control >=46; hint/status and CTA span both columns | A single ordered issuance flow, one primary submit |
| C10 Bank-slip top-up | #topup-upload-form, .coupon-form, .field | general form gap 14–16px (operational override 15), field label gap 7px, inputs >=44px | Bank selection, amount, evidence upload, pending outcome |
| C11 Issued QR/result card | .issue-result, .qr-wrapper | dashed border, padding 18px, gap 12, radius 16; QR viewport min-height 250px, centered | Only show after real issuance; do not fake valid coupon |
| C12 Fuel report filters | .os-report-filters, .field | horizontal flex, gap 12px, 8px side insets; field min 180/max 360; controls >=44px | Short filters adjacent to table, not repeated page search |
| C13 Fuel report table | .os-report-table-scroll, .os-report-table | inside bordered scroll container radius 12; table min-width 650; cells 13px 14px; numeric columns tabular/right | Completed transactions only, local scrolling on phone |
| C14 Mobile Home summary card | .os-mobile-summary-grid, .os-mobile-summary-card | 2 equal columns / gap 12, pad 14px; icon tile 34px; later shared override can enforce 14px radius | Informational card backed by actual role/module state |
| C15 Module launcher card | .os-mobile-feature-grid, .os-mobile-feature, .ws-quick | mobile 2 columns/gap 12, min-height 96, padding 14; desktop quick grid auto-fill min 230, padding 18, min-height 92 | Destination choice on Home only, never repeat above task tabs |
| C16 Profile trigger and popover | .os-profile-trigger, .os-profile-panel | trigger min-height 44px, avatar 34px; popover right-aligned max 320px with 18px 20px padding, radius 12 | Name/role menu, escape and outside-click to close |
| C17 Dialog/confirmation | .os-logout-dialog, .os-logout-actions | max width 400px, radius 18; actions 2 equal columns gap 10; <=480px stack; actions >=48px | Real cancel/confirm, no silent destructive action |
| C18 Status/notice/empty | .notice, .hint, .os-report-notice, .os-credit-empty | notices radius 12, padding 11px 14px; hint pad 12px 14px; statuses use text + semantic colour | Loading, no data, pending, success, error and retry |
| C19 Inline edit icon/text | .os-card-edit, .os-add-fab, .os-directory-icon-button | inline edit >=44px, radius 12; floating plus >=52px; compact record icon button 36px plus label/accessible name | Editing affordance only if backend actually supports it |
| C20 Report/table action row | .os-directory-actions, .os-report-summary | actions compact and aligned; report summary padding 11px 14px, flex-wrap | Secondary controls should not compete with primary financial task |
| C21 Search bar | .os-directory-search-wrap/input/submit | one field min-height 46px with inside magnifier 38px, right inset 54px; top spacing separate from sticky toolbar | One search for name/email/role, no duplicate external Search button |
| C22 Section title / context | .ws-section-heading, .ws-breadcrumb, .os-corporate-intro | title heading 16–18px, metadata 12–13, functional description compact | Align label and optional count; remove repeated section headings |

## Card variants: when to use them

**Simple card**: one header/body with flat border, as in module list, no invented KPI.

**Financial feature card**: label + large real currency + supporting source status + detail row + optional secondary verify action. Use muted gold only on upper rule, not full gold background.

**Action card**: heading + concise help + fields + one primary CTA; progressive disclosure for creating/editing records; current stored input survives task switching.

**Record card**: owner/name + metadata + authorized edit/delete icon(s) at bottom/right; confirmation for destructive action. If edit operation has no persisted API, do not show an apparently functional edit control.

**Evidence card**: full image contained (not cropped), evidence status, review actions and clear pending/error explanation. Real screenshots/data are private; component pattern is portable.

**Report card**: one filter row, summary row, responsive table inside its own horizontally scrollable border, export if actually supported.

**Empty/error card**: a readable reason and next action, not a fabricated 0.00 balance or empty ghost chart.

## Where the card header should be coloured

- **Green gradient + fine gold line** for **page-level and principal grouped card headings only**, where the destination uses green identity headers.
- **Cream / pale-green heading** for secondary in-panel tables and credit sections; e.g. .os-credit-head currently uses pale green, not solid emerald.
- Never apply a green gradient to every nested card header. This destroys hierarchy and duplicates page chrome.
- For a green card heading in a new project, make the gold pseudo-elements part of the same border-radius and isolate their stacking context; keep contents clickable and readable.

## Current CSS cascade warning

OilStation still retains compatibility selectors inside one stylesheet. The broad legacy rule in the current file approximately targets .ws-widget>section, .module-item, .os-plan-card, .os-mobile-summary-card, etc. with **border-radius:14px!important** and card surface/shadow overrides. Some older base selectors show 8/12/16px but the computed value may be 14px. Therefore:

- **Exact source value** means value written in a selector, not always final computed value.
- For reusable builds, choose the **normalized 16 / 12 / 10px radius hierarchy** and one owning selector; do not copy the entire legacy cascade.
- For OilStation changes, inspect computed styles with a browser before changing or claiming pixel parity; do not replace !important rules as part of documentation work.
- The optional component-patterns.css is a clean, separately namespaced *reference implementation*, not a replacement for OilStation's production CSS.
