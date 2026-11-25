# Stage 3: authentication and onboarding

**Status: implemented and tested locally. NOT verified against your real Supabase project. Do not treat as production ready until the checklist at the end is complete.**

## What was added (nothing from Stages 1 and 2 was removed or rewritten)
- **Migration 0014** (one new table, `policy_acceptances`, plus functions): versioned policy acceptance; consent and starting location captured at sign-up; `applicable_requirements()` (required and optional documents); submission now requires accepted policies; public-media bucket limited to 5 MB images.
- **Authentication:** register (customer or professional, with state/city, phone, privacy consent, optional marketing consent), sign in, sign out, forgot password, reset password, email-confirmation callback, open-redirect protection, generic error messages (no account enumeration).
- **Customer:** `/account` completion prompt, `/account/profile` (name, phone, preferred area, photo).
- **Professional onboarding** `/workspace/onboarding/*`: profile (individual or registered business, business details), services and pricing, coverage areas, portfolio, working hours and days off, verification documents, review and submit with policy acceptance. Workspace overview shows status, reviewer messages and activity.
- **Verification workflow:** private uploads in three steps (record, upload, confirm), owner-only viewing through 60-second signed links, locked after submission, reopened only by an administrator.
- **Admin (minimal):** `/admin/verification` queue and review page: open files through signed links, accept or reject each document, record the application decision. The full dashboard is Stage 8.
- **Draft policy pages** `/legal/[key]`, clearly marked as pending legal review.

## How access control works (unchanged model)
- Every read and write in Stage 3 runs through the signed-in user's session, so Row Level Security applies. **Stage 3 uses no service-role or secret key at all.** A build with canary secrets confirmed none reach the browser bundle.
- Role gates: middleware, each role layout, and each server action (`requireRole`), then RLS.
- Uploads: the browser uploads directly to Supabase Storage with the user's session. Storage policies (migration 0009) only accept a file for a document record the user already owns, and there is no update or delete policy for clients.

## Environment variables
| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, all environments | project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel | `sb_publishable_...`. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works |
| `NEXT_PUBLIC_SITE_URL` | Vercel | your production URL, no trailing slash. Used in email links |
| `PROTECTED_PAYMENTS_ENABLED` | Vercel | keep `false` |
| `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) | **leave unset for now** | only the payment webhook (Stage 7) uses it. If you add it, mark it Sensitive and never prefix it `NEXT_PUBLIC_` |

## Deployment steps
Do these on a **dev** Supabase project first.
1. **Install the Supabase CLI** and in the project folder run `supabase init` (once), `supabase link --project-ref YOUR_REF`, then `supabase db push`. This applies migrations 0001 to 0014 in order. Never run `supabase/tests/00_local_stubs.sql` on Supabase.
2. **Seed reference data:** run `supabase/seed.sql` in the SQL Editor (safe to repeat). On the dev project only, also run the demo seed (see SETUP.md).
3. **Run the read-only deployment check:** paste `supabase/tests/90_remote_readonly_checks.sql` into the SQL Editor. Every row must be `true`. (The "no demo professionals" row is expected to be `false` on dev.)
4. **Authentication settings** (Dashboard, Authentication):
   - URL Configuration: Site URL = your Vercel URL. Add redirect URLs `https://YOUR-DOMAIN/auth/callback` and your preview URL pattern.
   - Providers, Email: enable; turn **Confirm email** on; set **minimum password length to 10**; enable leaked-password protection if your plan has it.
   - Disable phone sign-in (OTP is not implemented).
   - SMTP: the default sender is heavily rate limited and for testing only. Configure your own SMTP provider (for example Resend) before real users, and edit the email templates to say DECA.
   - Rate limits and CAPTCHA: review the built-in limits and enable CAPTCHA for sign-up and sign-in before launch.
5. **Storage** (Dashboard, Storage): confirm four buckets exist: `public-media` (public), `verification-documents`, `message-attachments`, `dispute-evidence` (all private). The check script verifies limits and policies. Do not add dashboard policies by hand.
6. **First super admin:** register normally in the app, confirm the email, then in the SQL Editor:
   ```sql
   update public.profiles set role = 'super_admin' where email = 'you@example.com';
   ```
   Roles can never be set from the app.
7. **Vercel:** set the variables above and redeploy. Keep Deployment Protection on while testing.
8. **Production:** repeat steps 1 to 7 on a separate production project. Do not seed demo data there.

## Acceptance test on the real project (about 45 minutes)
Use a dev project. Expected results are in brackets.
- **A. Customer:** register as a customer with a state and consent (confirmation email arrives; link lands on sign-in with "Email confirmed"). Sign in (`/account`). Edit profile, upload a photo (appears), change area.
- **B. Wrong-role access:** while signed in as a customer open `/workspace` and `/admin` (redirected to `/account`).
- **C. Password reset:** use Forgot password (email arrives; link opens the reset form; new password works; old one does not). Request a reset for a non-existent email (same neutral message).
- **D. Professional onboarding:** register as a professional, confirm, sign in. Complete profile (individual), add a service with a price, add an area, add a portfolio photo, set hours. Switch the account type to business and confirm the business form and extra business-document requirement appear.
- **E. Documents:** upload a PDF for each required document (status "Awaiting review"; View opens it in a new tab, link expires in about a minute). Try a `.exe`, a 12 MB file, and a renamed text file (all refused). Remove one before submitting (allowed).
- **F. Submit and lock:** accept the policies and submit (status Submitted). Try to remove or replace a document (not possible). Sign in as a second professional and try to open the first one's file link (denied).
- **G. Admin review:** sign in as the admin, open `/admin/verification`, open a file, accept every required document, approve. As the professional the workspace shows Approved and the public profile appears in Explore. Then ask for more information with a reason: the professional sees the message and can upload again.
- **H. Storage isolation (SQL Editor):** `select count(*) from storage.objects where bucket_id = 'verification-documents';` shows the files, but a request to a file URL without a signed token fails (open the object's public-style URL in a private window; expect an error).
- **I. Database tests (dev project only):** run `supabase/tests/05_test_helpers.sql`, `10_smoke.sql`, `20_hardening.sql`, `30_discovery.sql`, `40_onboarding.sql` in that order. They create `[test]` rows and the `t` schema, so never run them on production. Expect `failed = 0` in each. Delete the dev test data afterward or recreate the dev project.

## Known limitations
- **Email links and browsers:** confirmation and reset links use PKCE and work best in the browser where the person signed up. Opening a link on another device may fail; for confirmation the email is already confirmed, so the person can simply sign in (the page says so). A token-hash flow is a later improvement.
- **Phone verification:** the number is collected and kept private; no OTP is sent. `phone_verified_at` stays empty.
- **Data minimisation:** date of birth and residential address are not collected (identity is evidenced by the uploaded document; proof of address can be added as a requirement by an admin). Payout details are collected in Stage 7 with the payment provider.
- **After approval:** professionals can still edit their public profile text and services. Rules requiring re-review for sensitive changes belong to Stage 4.
- **Availability save** replaces rows in two steps, not one transaction.
- **Uploads:** type and size are enforced in the browser and by bucket limits; the actual file content is not scanned.
- **Rate limiting** is whatever Supabase Auth provides; no application-level limiter yet.
- **Policy texts** are drafts for counsel to replace.

## Production readiness checklist (all unticked until done on the real project)
- [ ] Migrations 0001 to 0014 applied; `90_remote_readonly_checks.sql` all true
- [ ] Auth settings in step 4 applied; custom SMTP working; CAPTCHA decided
- [ ] Acceptance scenarios A to I passed on the dev project
- [ ] Test files run on a Supabase project (storage policies and RPC exposure verified there)
- [ ] Verified that `auth.jwt() ->> 'role'` equals `service_role` for requests made with the new secret key (needed before Stage 7)
- [ ] Legal texts, retention periods and NDPA procedures approved
- [ ] Admin MFA and file-access logging (Stage 8), rate limiting, upload scanning
- [ ] Production project separate from dev; no demo data; Vercel protection reviewed
