# Navigation, headers, buttons and interaction anatomy

**Scope:** customer-company workspace visual navigation plus reusable operational shell. Source: src/client/workspace-layout.js, mobile-home.js, functional-submenus.js, user-profile.js, toolbar-credit.js, public/oilstation.css (2026-11-05).

## Navigation depth: there are only distinct responsibilities

1. **Primary destination navigation:** Desktop = permission-filtered left sidebar; mobile = bottom Home+frequent dock. It switches the workspace.
2. **Contextual functional navigation:** One horizontally scrolling row of tabs after toolbar and before the task-specific green page heading in the current DOM for **actual tasks within the selected workspace**. It switches the active task card, *not the entire module*.
3. **In-card actions:** Submit, edit, upload proof, inspect, refresh data, cancel. These are not navigation tabs.

No duplicate top-level menu in a submenu. No permanent hamburger or floating scan button added to satisfy a template. Home shows the authorized full catalogue; non-Home shows only its tasks. A data-record card is never promoted to its own navigation tab.

## Desktop sidebar specification — current

| Detail | Source value |
|---|---|
| Sidebar | sticky height 100dvh, width --os-side-w = 248px |
| Palette | green menu gradient, light text, delicate gold arc behind controls |
| Padding | 24px top/bottom, 14px left/right |
| Vertical grouping gap | 26px for the major brand/navigation/footer regions |
| Navigation item | min-height 46px, gap 12px, horizontal padding 12px, radius 12px |
| Icon and label | icon at left; 14px label, icon in its own flex cell |
| Hover | darker forest-surface highlight |
| Selected | warm page-colour field + deep emerald text, font-weight 700 |
| Brand | 37x37px mark; 18px heading, 10px tracked caption |

Sidebar is role-filtered from selectWorkspaceScreens. Local frequency counts never grant a destination.

## Toolbar specification — current

- Desktop: sticky at top, z-index 20, minimum 72px, horizontal gap 16px, inner x-padding clamp(24px,3.4vw,48px); forest gradient and subtle gold arc/1px lower rule.
- Content alignment: scoped credit uses margin-left:auto, then named profile, then 44x44 logout icon.
- Credit: label 10px; amount 17px, light text and tabular figures; selector for multiple eligible accounts; not shown to driver-only roles.
- User: clickable avatar/username/role, popover with name/email/roles, keyboard Escape and outside-click; source initial avatar 34px.
- Logout: icon + meaningful accessible label and confirmation; never display an icon-only destructive action without a label/tooltip.
- Mobile <=850px: toolbar min-height 64px, x-padding 12px, gap 8px, credit flexes, then profile, then logout; the profile is never moved to a second row merely to make room for an invented refresh button.
- Phone <=480px: credit amount 13px, profile avatar 29px, name max width 66px; do not hide the name altogether. Long figures should be tested for truncation at 320px.

**Live truth:** current balance polling happens while visible approximately once per 60 seconds, and on foreground/navigation when stale (~30 seconds); no manual refresh button. This is a functional policy in the source, not a visual property to hardcode into an unrelated project.

## Contextual task tabs — current

- Container .os-functional-nav: single horizontal row, overflow-x:auto, gap 8px, margin 12px 0 4px, bottom padding 5px. Phone uses inset x-padding 16px and hides scrollbar.
- Tab .os-category-tab: min-height 44px, left/right padding 12px/16px, gap 8px, full pill radius (999px), 14px semibold.
- Normal = quiet transparent/cream surface + subtle border/muted text; hover = pale green wash; selected = emerald menu gradient with cream text, modest shadow.
- Icon is grouped with label; **selected state is conveyed by aria-pressed/aria-current as well as colour**.
- Changing tasks hides other panes but leaves their DOM mounted, so unsaved field contents are preserved.
- Tabs are derived from real functional section cards. Conditional tabs are hidden by real privileges, not simply by CSS.
- Corporate task tabs: บัญชีบริษัท; แจ้งเติมเงิน; เติมเงินทดสอบ (QA only); รถและคนขับ (per permission); ออกคูปอง (per permission); รายงานเติมน้ำมัน.
- Station-owner customers are a different task set: เครดิตลูกค้า; เปิดบัญชีบริษัท; เชื่อมบริษัทเดิม; รายงานเติมน้ำมัน.

## Mobile bottom dock — current

| Detail | Current source value |
|---|---|
| Visibility | <=850px; desktop sidebar shown instead |
| Position | fixed to bottom, z-index 40 |
| Base minimum height | --os-dock-h = 72px, plus safe-area bottom padding |
| Surface | dark forest menu gradient and restrained gold trim |
| Inner layout | max-width 540px centered, 5 CSS grid visual slots, justify-items:center |
| Actual actions | Home + up to four most frequently opened permitted destinations |
| For fewer actions | empty slots inert; occupied slots centered/spaced in five-column grid |
| Tab | min-height 56px, grid place center, gap 3px |
| Orb | 44px wide x 28px high, fully rounded; icon ~21px |
| Caption | 11px, semibold, ellipsis if necessary |
| Selected | cream pill/orb with emerald icon, brighter caption |
| Click behavior | per-user frequency stored locally; order updated on returning Home to avoid targets shifting mid-task |

The five-slot dock is **not** a guarantee of five authorized actions. Do not invent unknown permissions to fill slots. No bottom hamburger; do not put another scan FAB in the center unconditionally.

## Button and control variants

| Pattern | Source geometry and surface | State and use |
|---|---|---|
| Primary action | .button.primary, base height >=46px, padding 10px 20px, radius 10px, emerald/ivory | One main task submit; hover dark emerald; pending disabled |
| Secondary | .button.secondary, >=46px, cream-inset and quiet border | Inspect integrity, back, copy link; no confusion with approve |
| Destructive | .button.destructive, red with white text, explicit confirmation | Revoke/delete only where supported |
| Compact contextual tab | .os-category-tab >=44px pill | Navigate within current screen; always real pane |
| Sign-in provider | .os-auth-provider >=50px, full pill | True OAuth provider branding, real sign-in action |
| Logout icon | .os-toolbar-logout 44px square desktop / 38x40 mobile *current code* | Accessible name; for new apps aim >=44px touch target even on phone |
| Record edit | .os-card-edit >=44px, radius 12px | For a real persisted edit operation only |
| Floating add | .os-add-fab >=52px, gold accent | Authorized create action; above mobile dock/safe area |
| Table row icon action | .os-directory-icon-button 36x36 current | Ensure sufficient combined hit area and accessible label in adapted builds |
| Coupon submit | #coupon-submit >=46px, min-width 230px on desktop | Full-span row under 2-column fields |
| Mobile Home shortcut | .os-mobile-feature min-height 96px, x-padding 14px | Primary module destination with icon and label |
| Search submit inside input | .os-directory-search-submit 38x38 current | Magnifier housed inside single 46px search field |

## In-card search and commands

- Single search field, placeholder "ค้นหาชื่อ อีเมล หรือบทบาท" for staff directory when that feature is relevant; one trailing magnifier inside it. Do not add a second large "ค้นหา" button beside the same field.
- Filters on reports are different: company/plate controls and a single Search Report action if the report actually supports filtering.
- Keep CTA at end of current task; report read actions should not visually compete with financial Approve.
- Buttons contain a real icon (Lucide allowlist) plus text when their outcome matters. Don't use decoration-only emoji as the entire actionable label.

## Keyboard and accessibility

- Visible focus outlines around button, tab, profile and dock.
- Tabs use button semantics, aria-current/aria-pressed appropriate to pattern.
- Interactive areas >=44px preferred, with explicit tooltips/labels for icon-only actions.
- Escape closes popover/dialog; focus returns to trigger. Dialog cancel does not submit.
- Hidden task pane must not be keyboard-accessible while hidden; remounting it on every tab switch is forbidden because it erases state.
- No CSS-only permission granting; menu items are created from server-approved membership screens.
