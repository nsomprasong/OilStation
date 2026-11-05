# Layout blueprint, spacing and responsive measurements

Use this as a **measurement contract** when applying the skill elsewhere. This is extracted from the current code and documents **declared CSS**, not post-render screenshot measurements. New projects should implement normalized hierarchy, not import the OilStation legacy cascade.

## Spacing scale and rhythm

| Token | px | Main application |
|---|---:|---|
| micro-1 | 4 | tight label and caption separation, icon-caption docking |
| micro-2 | 8 | tab-to-tab, compact actions, inset margin from an outer card |
| small | 12 | card-grid, record rows, table filter gap |
| medium | 16 | page and pane rhythm, normal task card gap |
| large | 20 | typical task/card padding, title panel padding |
| section | 24 | vertical separation between independent task groups |
| major | 32 | major desktop overview columns, major sectional gap |
| max | 48 | desktop horizontal content padding upper bound |

Additional existing source values: form vertical gap 14/15, coupon-form row-gap 14px and column-gap 18px, input label gap 7px, panel main padding 18–28px, driver assignment form 18px, credit detail row gap 9px, profile trigger gap 10px. Preserve meaningful alignment rather than forcing every number into a rigid multiple of four.

## Card nesting and white space

- Outer page header x-padding 24px (customer page 22px), y-padding 20px (customer 18px), radius 16px.
- Current corporate DOM order: sticky toolbar → horizontal contextual tabs → task-specific green heading → active pane. Header margin-bottom is 18px (customer 14px). **Do not add a second repeated heading** above the active card.
- Main task panel: reference 16px padding, then 8px gutters before inset elements, with normalized outer radius 16 and inner radius 12. Current legacy selectors can yield 14px on actual operational cards; see component-anatomy.md.
- Card contents: title (15–18px) → 8–12px subordinate text → line divider where meaningful → data/action with 12–16px gap.
- Grid card to card: usually 12px; related sections 16px; distinct app sections 24px.
- Report table gets 8px inline breathing room from host; scroll contained in table card.
- Long text wraps, number labels remain aligned and tabular, ellipsis is okay for nonessential titles but not for critical money without full-value access.

## Desktop shell layout

~~~text
Viewport 1440 / 1280 / 1024
┌─ Desktop sidebar 248px ─┬─ Workspace main (minmax(0,1fr)) ──────────────────┐
│ Brand                    │ Sticky 72px toolbar [balance] [profile] [logout]│
│ Role-filtered modules    │ Horizontal task tabs                            │
│ Selected destination     │ Screen-specific green page heading              │
│ Footer status            │ ONE active pane                                 │
│                          │   Cream cards / form / records / reports        │
└──────────────────────────┴─────────────────────────────────────────────────┘
~~~

- .ws-layout grid-template-columns = 248px minmax(0,1fr), min-height 100dvh.
- .os-desktop-sidebar sticky 100dvh, padding 24px 14px.
- .ws-main x-padding clamp(24px,3.4vw,48px), bottom 64px.
- Toolbar is intentionally edge-to-edge within main using negative matching horizontal margin, so its green strip fills the work area.
- Desktop Home: main overview columns minmax(0,1fr) + 300px sidebar/info region, gap 32; quick tile grid auto-fill min 230px, gap 16.
- Desktop corporate balance accounts: auto-fit cards min 280px, gap 12; station credit accounts min 260px, gap 12.
- Driver/vehicle workspace: main assignment 1fr + roster width 225–280px with 12/18px gaps until max-width 960px, then one column.
- Coupon form: two equal columns, row gap 14 and column gap 18; action spans two columns; max-width not hardcoded in source.

## Mobile layout

At max-width **850px**:

- Hide desktop sidebar and desktop overview columns; main horizontal padding = 16px.
- Main bottom padding = 72px dock + 28px extra + safe-area inset.
- Top toolbar min-height 64px, margin-inline -16px, padding 9px 12px, gap 8; credit, profile and logout are one row.
- Page hero/functional context gets ~14px top padding, 12px bottom; tabs horizontal scroll with 16px inset each side.
- Corporate coupon form becomes one column at **max-width 680px**; before that it may remain two columns if sufficient width.
- Driver assignment cards stack at **max-width 960px** (including small desktops/tablets).
- Mobile Home: summary cards 2 columns gap 12; service launcher 2 columns gap 12; summary card padding 14; launcher min-height 96.
- Dock inner: width 100%, max-width 540px centered, five grid slots; bottom fixed, visual gold border, safe-area.
- Create FAB if present: right 16px and bottom = dock height + 16px + safe area.

At max-width **480px**:

- Profile/credit type compress, auth heading ~30px, logout-confirm dialog buttons stack.
- No viewport horizontal scrolling; keep horizontal overflow **inside** task nav and tables.
- On 390/360/320 widths ensure credit amount, profile name and logout all remain legible. Do not claim that the existing code has passed every device without real browser evidence.

## Minimum target sizes and type scale

| Role | Source/target |
|---|---|
| Base body | 15px / line-height 1.6; Thai-compatible sans |
| Page heading | clamp(24px,3vw,32px), line-height ~1.35 |
| Task panel heading | 16–18px |
| Card name | ~14–15px; financial amount 23–32px |
| Metadata | 11–13px; careful contrast on cream |
| General button | >=46px; primary mobile >=44px |
| Form controls | >=44px, corporate coupon >=46px |
| Tab | >=44px; ellipsis for long labels |
| Search input | >=46px; inner magnifier ~38px |
| Profile trigger | >=44px; 34px avatar desktop, 29px very narrow phone |
| Dock icon pill | 44x28px; icon 21px; item min-height 56px |
| Dialog CTA | >=48px, radius 12px |

## Vertical spacing recipe — new project

1. Sticky toolbar occupies its own top strip: no extra search bar jammed above it.
2. Contextual tab row follows toolbar in current DOM, with 8px gaps and small 5px lower breathing room.
3. Page title follows tabs with 12–20px top margin and 14–18px bottom. Do not render a redundant global heading; active pane starts promptly after it.
4. Pane content has 16–20px padding, with adjacent separate cards 12–16px apart and inset cards 8px from panel edges.
5. CTA aligns to the form edge or spans entire mobile width as needed; final CTA cannot be hidden behind dock.
6. Readable footer/empty/status messages maintain 10–14px separation from last control.

## Source-specific caveats / CSS debt

OilStation's one stylesheet has historical compatibility overrides. This design skill records the **visual language**; it does not reproduce selector conflicts. In particular, a broad .os-midnight-layout selector can force radius 14px and shadows with !important on many cards, while component-local rules sometimes specify 12/16px. Using both in another project would recreate the conflict. Recommended new implementation:

- Single theme token map with 16px main / 12px nested / 10px controls.
- One owning CSS selector per component variant, no widespread !important.
- Restrict green gradients/gold lines to structural headers, not every nested surface.
- Keep card interior x-padding, spacing, and table scroll independent of business DOM.
- Check computed styles and screenshots before saying a new app is pixel-matched.
