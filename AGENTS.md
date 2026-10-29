# OilStation agent instructions

OilStation is a Thai-first, multi-tenant petrol-station SaaS. Preserve authentication, station/company tenant isolation, financial ledgers, coupon locks, HR permissions, and operational clarity in all changes.

## Frontend skill

For frontend design, layout, styling, accessibility, redesign, or visual QA, use the project-installed **design-taste-frontend** skill at `.agents/skills/design-taste-frontend/SKILL.md`, copied from `Leonxlnx/taste-skill`.

- **Operational app screens:** dashboards, station operator panels, fuel/coupon workflows, financial forms, HR scheduling and payroll MUST use `references/app-screens.md` (the `--app` design and inspection mode), not the landing-page workflow.
- **Public marketing pages:** may follow the page-design workflow separately, with a consistent OilStation visual identity.
- Preserve Thai-first layout, mobile accessibility, keyboard navigation, reduced-motion support, legible numeric values, loading/error/empty states and safe confirmations.
- Do not fabricate balances, prices, customer data, transactions, chart figures, payroll or approval states just to decorate an interface.
- Avoid unreviewed animation that could delay cashiers, fuel attendants or administrators. Never weaken validation, privacy or role checks for aesthetics.
- The vendored skill's optional scripts require Node >=22 and installed Chrome/Edge/Chromium; they run only for local design QA, never in production.
- Generated `.taste-skill/` output is ignored by Git. Keep vendor files pinned; review upstream before updating.

## Workflow and release

Use the project's existing Superpowers workflow, write tests for behavior changes, and verify Build/CI before claiming success. Do not merge or deploy to `oilstation.goldensoft.cloud` without approved release gates and explicit production/test rollout authorization.
