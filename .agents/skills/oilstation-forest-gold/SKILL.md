---
name: oilstation-forest-gold
description: >-
  Reusable, Thai-first Forest Emerald / Warm Cream / Muted Gold full UI design skill,
  extracted from OilStation's approved Login and corporate-customer workspace.
  Use for login and authenticated SaaS application screens, customer credit,
  top-up, vehicle/driver, coupon and reports, cards, buttons, navigation,
  complete screen composition, spacing and responsive layouts; also when the user requests the
  OilStation visual language in another project. Preserve the target product's
  brand, access rules, data and stack.
---

# OilStation Forest & Gold — reusable interface design skill

## Intent

Apply the deliberate visual system seen in OilStation's approved Login and corporate-customer workspace, without cloning their underlying business logic. The outcome is a restrained premium operational UI: pine/emerald greens for identity, warm ivory work surfaces, fine champagne-gold rules, compact trustworthy data and clear Thai-first actions.

**Extracted from the repository on 2026-11-05** (not a guarantee of the live site's currently deployed state). In OilStation, live code and newer approved instructions take precedence if the implementation changes after this extraction.

## When to use

- Login, invite-only access, OAuth/QA sign-in or account-recovery surfaces.
- Authenticated admin/customer screens with balances, operational forms, tables, tabs and responsive menus.
- OilStation customer-company workspaces: credit, real/QA top-ups, vehicles/drivers, coupon issuance and completed-fuel reports.
- A different project when the user explicitly wants this green/cream/gold visual language.

Do not apply to public marketing pages unasked. Do not invent accounting figures, change roles, claim successful payments, or carry over OilStation branding into another product.

## Complete UI component design system (v2)

This skill includes **35 named source-mapped components** and the full customer-company page compositions. It is no longer just a colour palette: it specifies each card's anatomy, inner header/body/footer, radius, grid placement, button state, navigation position, spacing and small-screen behavior.

**Start with the user intent, then consult the appropriate component source:**
- A card (balance, financial record, driver, QR, report, form, inset, empty) → `references/component-anatomy.md`.
- Bottom dock, contextual tabs, buttons, search, profile, sidebar/toolbar → `references/navigation-and-actions.md`.
- Exact declared pixel geometry, whitespace, responsive breakpoint and shell grid → `references/layout-and-spacing.md`.
- Full company-customer screen / each functional pane from top to bottom → `references/screen-blueprints.md`.
- Extractable, machine-readable component inventory → `assets/component-registry.json`.
- Portable opt-in standalone CSS and demonstration markup → `assets/component-patterns.css` and `assets/component-gallery.html` (requires `assets/forest-gold.tokens.css`). These are not production files.

**Important fidelity distinction:** documents state *current source-declared* values when citing OilStation selectors, and separately prescribe *normalized reusable* design choices. Historical high-specificity CSS can affect computed values; confirm exact screenshots with a real browser before claiming pixel parity.

## Required reading — read only what the task needs

1. references/tokens.md — visual identity, colour values, spacing and gold motif.
2. references/login.md — split hero/form login, auth safety and responsive rules.
3. references/customer-workspace.md — corporate work surfaces and financial UI.
4. references/adoption-and-qa.md — practical migration, accessibility, tests and project reuse.
5. references/component-anatomy.md — 22+ card/control/surface variants and exact anatomy.
6. references/navigation-and-actions.md — sidebar, contextual tabs, bottom dock, profile, buttons, search.
7. references/layout-and-spacing.md — exact source-declared measurements, breakpoints, gutters, normalized scale.
8. references/screen-blueprints.md — six corporate task panes and four station-customer screens, entire composition.
9. assets/component-registry.json — 35 source-mapped components for programmatic reuse.
10. assets/forest-gold.tokens.css, assets/component-patterns.css, assets/component-gallery.html — optional standalone specimen, never an automatic production import.

## Execution workflow

1. **Inspect the target.** Determine its real framework, existing design authority, canonical CSS entry point, auth/role architecture, user screenshots and functional flows. OilStation source map is in references/adoption-and-qa.md.
2. **Define the contract.** Apply the token roles from references/tokens.md. Preserve the palette relationships and hierarchy; remap naming if the target already has a semantic token system. Never add a second overlapping theme or append an override patchwork.
3. **Choose the applicable composition.** For login, use references/login.md. For entire customer screens use references/customer-workspace.md and references/screen-blueprints.md. For each visible card/action/layout follow component-anatomy.md, navigation-and-actions.md and layout-and-spacing.md. Apply only components genuinely needed.
4. **Honor operational truth.** Keep server-sourced balances, entitlement-gated tabs, real pending/error/empty states, intact form state while changing panes, approval confirmation and clear monetary units. Design is not authorization.
5. **Make responsive and accessible.** Desktop and Android widths, tab/keyboard focus, 200% zoom, safe-area insets, reduced motion, correct Thai wrapping and readable currency.
6. **Look and fix.** Review actual rendered screens at 1440, 1024, 390, 360 and 320 px, inspect overflow and functional states, run the project's CI/browser checks. Only report what you verified.

## Visual invariants

- One dark forest-green identity region contrasted with warm, soft ivory/cream surfaces.
- Desaturated gold is a **thin structural accent**: edge, underline, curved line. It is not a loud gold button on every card.
- Green gradient on navigation, page header and selected task tab; lighter cream/green gradient on page ground.
- Functional cards stay flat and readable; **normalized portable** hierarchy uses 16px main radius, 12px inset cards and 10px controls. The current OilStation CSS may compute 14px on some cards due to legacy overrides; see component-anatomy.md.
- Each non-Home view has one context-specific page heading and task selector. One active functional pane; no never-ending vertical stack of independent forms.
- Customer credit is a real scoped amount, never a placeholder metric made to decorate a design.
- Strong Thai sans-serif, modest labels, tabular monetary numerals and true provider brand icons.

## Guardrails

- OilStation uses one canonical stylesheet: public/oilstation.css. Amend owning selectors/tokens there; do not add another theme or blindly paste assets/forest-gold.tokens.css into production.
- In OilStation, use alongside .agents/skills/design-taste-frontend/SKILL.md and its references/app-screens.md for real-browser app inspection. This skill defines visual identity; the other skill guides craft and inspection, never replaces this palette.
- This skill does not include any authentication, Supabase, billing, QR or payroll implementation, and is intentionally safe to copy to other projects.
- The gallery is a **static illustrative specimen** without functioning buttons, actual amounts or valid QR. Do not confuse it with an authenticated screenshot.
- Preserve the destination project's existing component framework and logic; portable .fg-* classes are an optional design scaffold, not permission to add a conflicting CSS framework.
- No deploy, finance changes or auth changes are implied by installing or reading the skill.

## Reuse in other projects

Copy this **entire folder** to the destination repository's .agents/skills/oilstation-forest-gold/ and mention it in that project's AGENTS.md (or equivalent assistant instructions). Then adapt tokens, wording and logo to that project's brand. Merely linking a GitHub skill does not automatically register it in every ChatGPT conversation or editor; each environment needs its own skill discovery/import mechanism.
