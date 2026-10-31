# OilStation CSS architecture — canonical single source (2026-11-01)

**Source of truth:** `public/oilstation.css`, referenced once in `index.html`.
Google Fonts is an external font-only stylesheet and is not part of application CSS.

The preceding 14 files (`styles.css`, `workspace-gentelella.css`, `impeccable.css`, `gentelella-v4-selected.css`, `mobile-app.css`, `oilstation-unified.css`, `oilstation-brand.css`, `saas-plan-workflow.css`, `platform-sales-navigation.css`, `platform-sales-readonly.css`, `navigation-standard.css`, `functional-submenus.css`, `qa-mode.css`, `luxcart.css`) have been consolidated and removed.

## How it was migrated
The original stylesheet order was preserved for visual compatibility. A PostCSS AST pass removed only duplicate declarations for the **exact same selector and at-rule context** (same property, same importance/cascade); different selectors and breakpoints were left intact. This removed 458 redundant declarations and 82 empty rules, reducing app CSS from 170,551 bytes to 151,977 bytes (before any future maintenance changes). Existing behavior remains governed by JS, Supabase RLS and API authorization.

Section comments in the canonical file mark the original groups for maintainers. These comments denote history, **not separate active themes**. LuxCart's charcoal/cream/gold rules at the end remain authoritative. No separate compatibility stylesheet is required.

## Guardrails

1. Edit the existing owning selector in `public/oilstation.css`; **never append a new override file** or add extra `<link rel="stylesheet">` tags.
2. Prefer `var(--lux-*)` tokens for surfaces, typography, borders and actions; reserve semantic green/yellow/red/blue for real statuses.
3. Keep role-specific operations and human-readable Thai labels; do not change form DOM mounting or authorization just to restyle.
4. Run `npm run check` for CSS parse, duplicate-declaration and single-asset checks, `npm test` for application logic, `npm run build`, and `npx playwright test --config=playwright.luxcart.config.mjs` for Chromium screenshots and mobile overflow.
5. A future deeper selector-pruning pass requires screenshot/interaction coverage of authenticated station, corporate, payroll and finance workflows; static checks cannot prove unused selectors.

Changes to application CSS are reviewed through a normal Git feature branch and the required CI release gates.
