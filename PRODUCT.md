# OilStation

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
- Platform super administrator: creates stations, sets SaaS VAT and plans, sends the first owner's invitation.
- Invited station owner/manager: activates station functions, configures fuel, manages employees, evidence and customers according to role.
- Pump attendant/cashier: time-sensitive QR coupon, fueling and evidence workflows.
- Corporate customer: coupons, credit account and transaction history according to granted access.

## Product Purpose
Thai-first, invite-only, multi-tenant petrol station operations. A user should know the current station/scope, the next authorized task, the action's result and whether money movement has actually happened.

## Operating Context
Desk-based back-office administration and touch-first work at fuel stations. Critical workflows: create station -> invite first owner -> accept invite -> owner chooses SaaS plan/payment method; fuel configuration; coupon/receipt proof; attendance and review; SaaS billing.

## Capabilities and Constraints
- Existing Vanilla JavaScript, Vite and Supabase/Cloudflare architecture. No React rewrite.
- Server enforces platform, organization, station and corporate-company permissions; hidden menu items are not security boundaries.
- Preserve original monetary units, approval rules, server data, private images, payment status and legal disclaimers.
- A saved SaaS plan/payment choice is NOT a payment or active subscription.
- Browser content can be long Thai text, a large list, or no data. Forms must preserve values on errors.
- Site may be opened on desktop, tablet or touch phone; invite/email entry should be easy on mobile.

## Brand Commitments
OilStation; existing blue-green petrol-station identity and Lucide icon language. Functional, calm, Thai-first. No fabricated numbers, balances, transaction labels or proof of acceptance.

## Evidence on Hand
Source: `AGENTS.md`, `src/client/`, `public/styles.css`, `public/workspace-gentelella.css` and user feedback about unintuitive forms, long vertical layout, unhelpful email statuses and missing fuel operations.

## Product Principles
- One primary task and clear next action per screen.
- Visible scope, permissions and truthful server state.
- Use one vocabulary for controls, errors and confirmations.
- Prevent double submissions and never imply a payment has settled without server evidence.
- Work well on constrained phones and with keyboard-only input.

## Accessibility & Inclusion
Thai language; labels stay visible and actionable at 200% zoom, 320px device width, and mobile input focus. Support keyboard focus, screen readers and reduced motion.
