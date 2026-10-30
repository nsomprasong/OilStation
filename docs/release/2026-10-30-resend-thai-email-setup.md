# OilStation — Resend + Supabase Auth Thai email setup

Status 30 Oct 2026: `oilstation.goldensoft.cloud` has been verified by Resend; a human-operated Supabase Auth invite reached Gmail from `OilStation <no-reply@oilstation.goldensoft.cloud>`. This verifies the **Supabase SMTP delivery path only**; it does **not** prove the Cloudflare Worker Resend API path or that all invite/OTP and authorization end-to-end tests passed.

## Sender isolation

- Production Supabase project: `cxihsotcpdnalswfoysx`.
- Resend domain: `oilstation.goldensoft.cloud` (never `ea.goldensoft.cloud`).
- Supabase Auth sender: `no-reply@oilstation.goldensoft.cloud`, sender name `OilStation`.
- Supabase Auth SMTP: `smtp.resend.com`, port `465`, user `resend`, password = dedicated Resend `re_...` API key held only by Supabase.
- Cloudflare Worker email: separate `RESEND_API_KEY` encrypted secret, `INVITATION_FROM_EMAIL=no-reply@oilstation.goldensoft.cloud` plain-text variable, `INVITATION_EMAIL_ENABLED=false` until authorized UAT.
- Keep `OILSTATION_API_ENABLED=false` until all release gates pass. Do not merge/deploy business routes as an email test.

## Hosted Supabase Auth templates

Go to [Authentication → Email → Templates](https://supabase.com/dashboard/project/cxihsotcpdnalswfoysx/auth/templates). Open the matching template, set its Subject to the subject below, copy the **whole contents** of the matching HTML file into Body, and save. No repository commit can automatically change the hosted Supabase dashboard template.

| Supabase template | Subject (Thai) | Ready-to-paste HTML |
|---|---|---|
| Confirm sign up | ยืนยันอีเมลของคุณสำหรับ OilStation | [confirm-signup.html](../../supabase/email-templates/confirm-signup.html) |
| Invite user | คำเชิญเข้าสู่ระบบ OilStation | [invite-user.html](../../supabase/email-templates/invite-user.html) |
| Magic link or OTP | รหัสยืนยันการเข้าสู่ระบบ OilStation | [magic-link-or-otp.html](../../supabase/email-templates/magic-link-or-otp.html) |
| Change email address | ยืนยันการเปลี่ยนอีเมลของ OilStation | [change-email.html](../../supabase/email-templates/change-email.html) |
| Reset password | ตั้งรหัสผ่าน OilStation ใหม่ | [reset-password.html](../../supabase/email-templates/reset-password.html) |
| Reauthentication | รหัสยืนยันการดำเนินการ OilStation | [reauthentication.html](../../supabase/email-templates/reauthentication.html) |

All files use only documented Supabase Auth variables such as `{{ .ConfirmationURL }}` and `{{ .Token }}`. Do not replace these placeholders with fixed URLs or invented OTPs. These templates do not grant station/company memberships.

**Important separation:** The current app uses Google/Facebook OAuth to log in, and its **scope-based, single-use invitations** are generated inside OilStation and sent via the Worker Resend API. Supabase Dashboard **Invite user** is a convenient *SMTP delivery test*, not a substitute for the station/company invitation. Likewise, the Supabase Auth Magic Link/OTP template is NOT the same as OilStation's distinct 8-digit invited-mailbox challenge.

## Safe validation

1. Leave public signup disabled; do not enable unaudited auth providers or change RLS.
2. Save the templates in Supabase and test on a controlled test mailbox with an authorized Supabase Auth invite.
3. Verify the subject/body is in Thai and sender is exactly `no-reply@oilstation.goldensoft.cloud`. Verify delivery in the Resend dashboard. Do not share live magic links or OTPs in tickets or screenshots.
4. Test the Worker Resend path separately after the full Worker and migrations are deployed to an **isolated UAT** environment using a valid scoped invitation and authenticated test account. Confirm a mismatch-email user cannot accept without a correct, unexpired OTP; tests must include 5 wrong guesses, resend invalidation, other actor, different station and replay. Use an independent supervisor and fake organizations only.
5. Keep the production invitation switch `INVITATION_EMAIL_ENABLED=false` until release approval. Never assume `email_accepted` means delivered; the provider only acknowledged a message.
6. Before production enablement, review Auth settings, quotas, Resend analytics, backup/restore, privacy, and rollout controls.

## Template ownership

- Email layout and security validations for the Worker: `src/notifications/invitation-email.mjs`.
- Dedicated test cases: `test/notifications/invitation-email.test.mjs` and `test/notifications/invited-email-otp.test.mjs`.
- Supabase dashboard cannot be configured through the currently connected Supabase tool; the HTML files are a prepared artifact for operator copy/paste.


## Isolated UAT guard — implemented after the email setup

The actual UAT Cloudflare Worker currently has Supabase encrypted bindings,
but their **values cannot be inspected** using Cloudflare's settings API.
Never assume those secrets refer to an isolated staging project.

The application now stamps `OILSTATION_DEPLOY_TARGET=uat` in the Wrangler UAT
environment. Even if someone accidentally switches
`OILSTATION_API_ENABLED=true`, business endpoints, `/api/ready`, and scheduled
tasks stay blocked until **both** conditions hold:

1. `OILSTATION_UAT_SUPABASE_REF` is a separate 20-character Supabase project
   reference, different from production `cxihsotcpdnalswfoysx`.
2. The actual `SUPABASE_URL` binding **exactly** matches
   `https://<OILSTATION_UAT_SUPABASE_REF>.supabase.co` (optional trailing slash),
   and the independent `oilstation_release_status()` database gate returns
   the required schema version and `ready=true`.

No separate billable Supabase branch or project has been created by this change.
Until one is explicitly authorized, keep the UAT service offline for business
functions. A UAT deployment may still serve the public application shell and
`/api/health` without opening any business route.

**Email safeguards in UAT:** set `OILSTATION_UAT_TEST_EMAIL` to an explicitly
authorized test mailbox on the **UAT Worker only**. Both scoped invitations and
8-digit OTP sending reject all other destination addresses without calling
Resend, even when `INVITATION_EMAIL_ENABLED=true`. This is an exact,
case-insensitive address comparison, **not** an unbounded domain allowlist.

Before UAT delivery, configure a *separate UAT Resend Sending API key* as the
UAT Worker's `RESEND_API_KEY` secret and set
`INVITATION_FROM_EMAIL=no-reply@oilstation.goldensoft.cloud`.
Never move an encrypted production secret into source, chat, or a browser. Keep
`INVITATION_EMAIL_ENABLED=false` until a reviewed, isolated test run is
authorized; UAT Worker does not inherit its production bindings.

Release checklist:
- [ ] Approve and create a separate Supabase UAT DB (or paid staging branch), then apply and test pending migrations there
- [ ] Configure exact UAT project ref and UAT Supabase credentials
- [ ] Verify `/api/ready` returns 200 only when isolated DB passes release gate
- [ ] Set UAT-only destination mailbox and separately scoped Resend key
- [ ] Verify real email acceptance and delivery with approved test mailbox; reject foreign recipients and stale OTPs
- [ ] Keep production `OILSTATION_API_ENABLED=false` and `INVITATION_EMAIL_ENABLED=false` until full release authorization
