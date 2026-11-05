# Full customer screen blueprints (composition, content hierarchy, whitespace)

This is a design reference for **the whole customer-company screen**, not only a token sheet. It describes the real OilStation corporate screen responsibilities from src/client/main.js / functional-submenus.js, with structural ASCII diagrams (no production account data). Only display tabs and sections permitted by the actual session.

## Whole-screen desktop skeleton

~~~text
┌─────────────────┬────────────────────────────────────────────────────────────┐
│ Forest sidebar  │ Forest top toolbar + fine gold sweep                      │
│  logo / nav     │ [actual credit if allowed] [avatar + name] [logout icon] │
│  selected       ├────────────────────────────────────────────────────────────┤
│  destination    │ [Account] [Top-up] [QA?] [Drivers?] [Coupon?] [Report]   │
│                 │ One compact task title + description in green header      │
│                 ├────────────────────────────────────────────────────────────┤
│                 │ ONE selected task pane                                     │
│                 │   ordered content / inset record cards / one main CTA     │
│                 │   supporting real status or scroll-local report table    │
└─────────────────┴────────────────────────────────────────────────────────────┘
~~~

The generic .ws-header is **suppressed** for corporate because its contextual task heading supplies the title. **Current DOM order is toolbar → contextual task tabs → screen-specific green page header → active pane**, as defined in renderWorkspaceShell (ws-context-host comes before ws-content). Do not duplicate the outer page title, functional-pane header and card header.

## Whole-screen phone skeleton

~~~text
┌──────────────────────────────┐
│ dark green / gold toolbar    │
│ real credit | profile | exit │  (one row)
├──────────────────────────────┤
│ [tab][tab][tab]  → scroll    │
│ concise current-task title   │
├──────────────────────────────┤
│ selected pane                │
│  cream card                  │
│    section label             │
│    field/amount/list         │
│    status / action           │
│  (stacked data records only) │
│                              │
├──────────────────────────────┤
│ five-position center dock    │  (Home + permitted favourites)
└──────────────────────────────┘
~~~

Page body reserves space for dock and safe-area. On mobile, slide only the tab row/tables horizontally, never the entire viewport.

## Each functional screen (real task, real UI slots)

### 1. บัญชีบริษัท / Account & credit

**Order:** short introduction to available balance after coupon reservations → green credit banner showing selected linked account → 1..n available account cards → applicable relationship/pending link or bank option details → status/secondary integrity check.

**Account card anatomy:**
- Top: station name as title.
- Main: available Baht amount, large emerald numerals (or actual loading/error).
- Caption: explicitly states coupon reservations already deducted.
- Secondary: "ตรวจยอดจองคูปองและลูกหนี้" (wallet integrity) only if API permits; details appear below in quiet tone.
- One account per card, responsive grid; no fake overview KPI.

### 2. แจ้งเติมเงิน / Real transfer

**Order:** one bank/account choice → amount in Baht → JPEG/PNG slip evidence → submit to station → pending/success/error notice → explanation that submission is not credit approval.

**Card anatomy:** title, 3 form fields, green primary submit, subdued warning/help. Current top-up form uses the general coupon-form grid, not the coupon's special 2-column form.

### 3. เติมเงินทดสอบ / QA test-credit

**Order:** explicit "QA / simulated" identity → test request form → server-scoped reviewer approval status → separate test-credit result.

Do not present a mock deposit as a real transfer, do not show this task outside actual QA entitlements. Keep gold as brand accent, not fake bank status.

### 4. รถและคนขับ / Vehicles and drivers

**Desktop:** heading and short explanation full width → left form (one column, padding 18px) → right roster/list (225–280px). Gap ~18px between columns; roster records gap ~10px.

**<=960px:** stack form above roster in a single column.

**Record anatomy:** associated name/vehicle or plate, secondary metadata, explicit assignment/validation status, permitted actions only. If photo proof required, show the complete photo and real review outcome. Never substitute OCR inference.

### 5. ออกคูปอง / Issue coupon

**Order:** Select station → fuel type → per-coupon Baht limit → eligible driver → verified assigned plate (readonly) → duration → reservation explanation → primary action → status.

**Desktop:** two-column fields gap 14px vertical/18px horizontal, 20px form inset, 16px radius. Hint, CTA and notice span both columns.

**<=680px:** single-column form; CTA full-width.

**Successful issuance:** separate result card, share-link/copy action and centered QR minimum 250px. Only show QR output of a real issued coupon. A reserved coupon does not equal a completed fuel transaction.

### 6. รายงานเติมน้ำมัน / Completed fuel report

**Order:** concise explanatory note → applicable filters (station-side company + plate; corporate-side plate only) → one action to query → summary (real count/aggregate) → table within scroll wrapper → loading/empty/error state.

**Table anatomy:** time/date, station or company as appropriate, plate, fuel, volume, Baht amount; column order follows actual API output. Numeric columns use tabular glyphs, right alignment. No guessed date/price, no redeemed vs reserved confusion.

## Station owner: ลูกค้าบริษัท is a distinct workspace

Do not copy the corporate company tabs onto station-owner screens. Its functional panes are:
- เครดิตลูกค้า — linked company balances and pending top-up review action;
- เปิดบัญชีบริษัท — authorized creation;
- เชื่อมบริษัทเดิม — cross-station link request with approval process;
- รายงานเติมน้ำมัน — completed-fill report, filter company/plate.

It uses the same card/gold/green/filter grammar but distinct APIs and role scopes.

## Shared pieces that appear on all customer subpages

- Sticky toolbar with real credit/profile/logout, no manual refresh CTA.
- Role-filtered main navigation and contextual functional tabs.
- One green rounded heading at the appropriate hierarchy level.
- One selected pane, in-panel cream surfaces, consistent border/padding.
- Main action plus pending/approved/rejected/error/empty/retry copy.
- Responsive, accessible icons with text labels.
- Real data only; no sample customer, amount or QR visible as live UI.

## Static demonstration vs real application

A standalone gallery at assets/component-gallery.html provides layout inspiration only. It intentionally shows '—' for money, no valid QR and disabled example controls. It is **not** a screenshot or a functional OilStation client. For exact verification, open the real role-authenticated app and compare actual rendered surfaces at multiple widths with keyboard/tab interaction.
