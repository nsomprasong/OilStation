# Login composition — approved OilStation reference

Source of truth: src/client/auth-screen.js and the .os-auth-* rules in public/oilstation.css. Applies to Login, invitation and first-admin setup, not just a public landing page.

## Desktop composition

- Full viewport dark forest radial canvas.
- Centered max ~1100px cream frame, border 1px forest-grey, radius 24px, restrained broad shadow; min-height roughly 570–720px based on viewport.
- **Left angled forest hero**: absolute left area about 61% of frame; clip-path polygon(0 0,73% 0,100% 100%,0 100%); gold fine diagonal edge, not an oversized gold graphic.
- Hero content: brand wordmark and emblem at upper left; 11px tracked uppercase eyebrow; confident Thai heading, two-line emphasis with warm gold italic word; one supporting line; short eligibility note at bottom.
- **Right cream sign-in area**: margin-left ~55%, width ~45%, generous 26–54px horizontal breathing room. Small kicker, 25–34px heading and tiny gold 44px underline; one sentence describing eligibility.
- OAuth providers are **real functional buttons**: Google with its proper multicolour logo, Facebook with its proper provider logo. Primary green pill and quiet outline secondary; 50px minimum height, full width and 11px vertical gap.
- Short shield / invite-only notice below buttons. Inline status message inside card, not a generic toast that obscures fields.
- QA username/password form is rendered only when actual QA mode permits it; underlined, warm neutral inputs and a full-width pill action. Keep real authentication and validation unchanged.

## Phone / <=850px

- Preserve the angled identity, but make frame **one column** with no overlay over sign-in controls.
- Hero becomes a ~246px top panel, clip-path polygon(0 0,100% 0,100% 100%,0 90%), with a thin gold sloped border at its bottom.
- Form/card follows hero in normal document flow; padding ~22px 26px 30px; no separate desktop-right margin; short headline and accessible providers visible without awkward clipping.
- Under 480px, heading can compress to ~30px and action buttons remain at least 44px tall.
- Avoid tall animations and clipped login forms with mobile keyboard or 200% zoom.

## Semantics and safety

- Use sections/headings, explicit descriptive button text, a role=status notice, correct labels/autocomplete for username/password.
- Keep OAuth brand art local/legitimate; no fake provider logos or misleading sign-in success state.
- Passwords and tokens do not belong in screenshots, demo files or skill assets.
- Login does not grant permission by itself; invited-membership and tenant checks happen in the product.
- Invitation/setup variants keep the same form surface but replace instructions with state-specific copy and real error/retry.

## Quality bar

Check desktop 1440/1024, Android 390/360/320, landscape keyboard focus, no angled overlay obscuring actions, true provider icons, readable Thai and keyboard focus rings. Browser animations must honor prefers-reduced-motion.

For another brand, reproduce the split geometry and colour roles but **replace** the OilStation mark, wording, links and authentication provider configuration with the destination product's own.
