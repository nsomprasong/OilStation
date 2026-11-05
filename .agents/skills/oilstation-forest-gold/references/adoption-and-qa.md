# Adoption and verification

## Source map — OilStation current design

| Responsibility | Authoritative file |
|---|---|
| Colours, gradients, radii, login/shell/corporate CSS | public/oilstation.css |
| Login hero, providers, QA/invite variants | src/client/auth-screen.js |
| Desktop sidebar, toolbar, screen containers, navigation | src/client/workspace-layout.js |
| Contextual task tabs + corporate panes | src/client/functional-submenus.js |
| Mobile home and 5-slot dock | src/client/mobile-home.js |
| Scoped live toolbar credit | src/client/toolbar-credit.js |
| User avatar/popover | src/client/user-profile.js |
| Completed fuel report | src/client/station-customer-reports.js |
| Project engineering conventions and release gating | AGENTS.md |
| Earlier design decisions, with archive caveats | DESIGN.md; docs/design/ |
| Reusable visual contract | this skill |

Note: Some historical classes contain the word midnight or teal even though the **current resolved palette** is forest/cream/gold. Do not infer colours from legacy class names or copy archived guidance instead of actual tokens.

## Safe adoption in OilStation

1. Read AGENTS.md and current production-facing CSS / JS before editing. The visual identity from this skill must not override more recent user-approved changes.
2. Scope changes to the **one** canonical CSS file and the owning relevant component; do not create an additional global theme or append a stack of !important patches.
3. Use the existing icon allowlist and authentic OAuth brand icons; don't install another icon/CSS framework for a visual tweak.
4. Preserve server-driven navigation and actual corporate membership, credit, bank-transfer, coupon and report workflows.
5. For CSS-only work, inspect mobile and desktop; if changing behaviour, add or adjust appropriate tests.
6. Run npm run check, npm test, npm run build and the applicable Playwright suite; check actual browser screenshots and focus/error states.
7. Follow PR/CI/deploy approval requirements. Simply adding this design skill does not change or deploy the live UI.

## Adoption in an unrelated project

1. Copy the **entire** .agents/skills/oilstation-forest-gold folder from this repository into that project's own .agents/skills/ directory. Or install the folder through the environment's supported skill importer.
2. Add an entry to the destination project's AGENTS.md or equivalent: "Use .agents/skills/oilstation-forest-gold/SKILL.md for emerald/cream/gold Login and operational UI".
3. Read tokens.md, then apply the desired **roles** (not necessarily the original --os-* variable names). The supplied assets/forest-gold.tokens.css is optional and namespaced; it does not change an app until the app uses its variables.
4. Replace OilStation name, logo, messages, roles, endpoints, business semantics and any screenshot-specific wording. Never transplant authentication or financial business logic merely to match appearance.
5. Integrate into the target's existing design system and CSS bundling. Keep one obvious source of truth for tokens.
6. Check the destination app at 1440 / 1024 / 390 / 360 / 320 px. Record differences caused by its brand and requirements.

Reusable repository link:
https://github.com/nsomprasong/OilStation/tree/main/.agents/skills/oilstation-forest-gold

## QA checklist

- [ ] Dark forest identity, ivory surfaces, muted gold lines and Thai text look coherent across login and work screens.
- [ ] Gold arcs/lines never intercept pointer events, cover popovers, or reduce header legibility.
- [ ] No duplicated header, navigation catalogue, functional task list or search action.
- [ ] Desktop sidebar matches permissions; mobile dock is centered and slots are authorization-filtered.
- [ ] Credit and profile fit on the same mobile toolbar row, with usable typography at 320px.
- [ ] Single active task pane; hidden pane retains form state.
- [ ] Real loading / empty / error / success states; no fake financial balances or approval states.
- [ ] Keyboard tab order, Escape for popovers/dialogs, focus rings and zoom to 200%.
- [ ] Touch targets >=44px for primary actions; no screen-wide sideways scroll.
- [ ] No inappropriate new stylesheet, runtime dependency, role grant, data mutation, or deploy.
- [ ] Tests and actual browser evidence support any claim of visual/functional PASS.

## Source boundaries

This package documents design and supplies a token starter only. It deliberately **does not include** screenshots of identifiable customers, any tokens/passwords, proprietary branding beyond documented names, or SQL/API workflow code. It is not an automatic globally installed ChatGPT plugin skill; reuse requires import into each new project's assistant/workflow context.
