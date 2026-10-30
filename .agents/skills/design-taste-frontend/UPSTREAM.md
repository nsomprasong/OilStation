# Vendored skill: design-taste-frontend

Upstream: https://github.com/Leonxlnx/taste-skill
Source directory: `skills/taste-skill/`
Pinned revision (full): `12af471f627f866411b4bd785b19646d3672784c`
Installed directory: `.agents/skills/design-taste-frontend/`
License: MIT; see the included `LICENSE` (preserved from upstream).
Installed mode: project-scoped Codex/Agent Skill (not a global ChatGPT plugin).

The original SKILL.md, scripts, assets, reference documents, JSON libraries, README and evaluation metadata are preserved. Check upstream changes before upgrading or executing external scripts. This skill is **development tooling**, not a runtime dependency.

## Use in OilStation

1. For QR/Cashier/Corporate/Admin/HR dashboard design, read `references/app-screens.md` entirely before designing. Use its app-specific `draw.mjs --app` and `inspect.mjs --app` workflows.
2. Keep data, localization, errors, and authorization correct; never invent real financial amounts in screens.
3. For landing/marketing pages, use the separate page-design flow.
4. Run locally from the repository root with Node.js 22+ and Chrome/Chromium for visual inspection. There is no requirement for the deployed Cloudflare Worker to run these design scripts.

To update: review the exact upstream commit, then re-vendor the same folder and replace this revision, preserving the upstream license.
