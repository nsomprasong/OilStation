# OilStation agent instructions

OilStation is a Thai-first, multi-tenant petrol-station SaaS. Preserve authentication, station/company tenant isolation, financial ledgers, coupon locks, HR permissions, and operational clarity in all changes.

## User-selected frontend authority

Use **Gentelella v4 (Colorlib, MIT)** for OilStation's canonical color, typography, compact cards, forms and tables; **navigation uses the explicitly approved Home/contextual-orb/frequent-dock standard below, NOT the old sidebar, rail, drawer or hamburger**. The project's existing design-taste and Impeccable guidelines remain for accessibility/UX quality but must not replace the chosen Gentelella v4 identity. Consult `DESIGN.md` and `public/gentelella-v4-selected.css` before changing UI. Keep Thai copy, roles and existing production functionality.

## Mandatory navigation standard — 31 October 2026 (supersedes legacy navigation guidance)

- **Home** is the only screen that presents the entire role-authorized catalogue; do not add another full-menu column, sidebar, drawer or duplicated shortcuts.
- **Every non-Home screen** has one horizontal, compact, horizontally scrollable group of related submenus **directly beneath the Header**. The shortcuts use glossy circular 3D Lucide icons, light/shadow and short text beneath; hide this group on Home.
- **Bottom navigator:** exactly 5 visual positions on mobile and desktop: **Home** first, then the four most frequently opened authorized destinations. Only authenticated role-filtered screen keys from `selectWorkspaceScreens` may appear. When the user has fewer than 4 other permitted screens, leave the unused slots inert rather than inventing unauthorized menu items. Do not display an unconditional Scan button; authorized pump access is through its normal module.
- Frequency counts are browser-local and per-user (`nav-preferences.js`); sort most-used first but update the dock ordering when returning Home to avoid touch targets shifting while working. Stored preferences never grant permissions.
- Exactly **two persistent navigation surfaces**: contextual shortcuts after the Header and the five-slot bottom navigator. Full menu inside Home only. Internal task forms may still have necessary functional controls, not duplicate cross-screen navigation.
- Code authority: `src/client/workspace-layout.js`, `src/client/workspace-categories.js`, `src/client/mobile-home.js`, `src/client/nav-preferences.js`, `public/navigation-standard.css`. Preserve the code-level/CI assertions in `test/ui/navigation-standard.test.mjs`.
- No changes to customer money, invitation, authorization, or workflow API behavior while adjusting navigation. Do not resurrect old sidebar/floating hamburger markup to make obsolete tests pass.

## Frontend skill

For frontend design, layout, styling, accessibility, redesign, or visual QA, use the project-installed **design-taste-frontend** skill at `.agents/skills/design-taste-frontend/SKILL.md`, copied from `Leonxlnx/taste-skill`.

- **Operational app screens:** dashboards, station operator panels, fuel/coupon workflows, financial forms, HR scheduling and payroll MUST use `references/app-screens.md` (the `--app` design and inspection mode), not the landing-page workflow.
- **Public marketing pages:** may follow the page-design workflow separately, with a consistent OilStation visual identity.
- Preserve Thai-first layout, mobile accessibility, keyboard navigation, reduced-motion support, legible numeric values, loading/error/empty states and safe confirmations.
- Do not fabricate balances, prices, customer data, transactions, chart figures, payroll or approval states just to decorate an interface.
- Avoid unreviewed animation that could delay cashiers, fuel attendants or administrators. Never weaken validation, privacy or role checks for aesthetics.
- The vendored skill's optional scripts require Node >=22 and installed Chrome/Edge/Chromium; they run only for local design QA, never in production.
- Generated `.taste-skill/` output is ignored by Git. Keep vendor files pinned; review upstream before updating.

## Icon libraries

- Use the pinned `lucide@1.62.0` **for user-interface actions and navigation**. The shared allowlisted SVG renderer is `src/client/icons.js`.
- Use `simple-icons@16.36.0` **for known third-party provider logos only**, such as Google and Facebook. Keep brand SVGs local, respect brand usage rules and never imply affiliation.
- For responsive and accessible UI, keep text labels on consequential actions, render decorative SVGs with `aria-hidden=true`, and use the SVG currentColor by default. Do not load remote icon CDNs or bundle all icon names.
- Extend the allowlist and UI icon test when adding a new icon; avoid emoji as the only indicator for a financial or safety state.
- OilStation has vanilla-JS/Vite UI, **not React**, so do not install `lucide-react` or React Simple Icons wrappers.

## Workflow and release

Use the project's existing Superpowers workflow, write tests for behavior changes, and verify Build/CI before claiming success. Do not merge or deploy to `oilstation.goldensoft.cloud` without approved release gates and explicit production/test rollout authorization.
