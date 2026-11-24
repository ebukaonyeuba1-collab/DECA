# Decisions, assumptions and open dependencies

## Product owner decisions applied
1. Payments: Paystack sandbox behind a provider abstraction. No escrow built or advertised; `custody_mode` and a feature flag keep that honest.
2. Verification: manual review in the admin dashboard. `IdentityVerificationProvider` and `OtpProvider` interfaces exist; no vendor is hardcoded.
3. Locations: structured country/state/city/neighbourhood, multiple coverage locations per professional, nullable lat/long reserved for maps. No map SDK.
4. Category verification: rules are rows in `verification_requirements`, editable by admins. Baseline: government ID (all), business registration (business accounts). Trade licence rows are seeded as optional examples only.

## Engineering decisions
- Next.js 15.5 (not 16) for stability with `@supabase/ssr`; Tailwind 3 with CSS-variable tokens; Zod 3.
- Workflow writes are database functions so rules hold no matter which client calls them.
- `bigint` kobo for all money; commission in basis points, `null` = unconfigured.
- Bank details: last four digits plus provider recipient code only.
- Quotation revisions are new rows (`version`, `parent_quotation_id`); accepted quotations are frozen into `bookings.agreed_snapshot`.
- Seeded reference data: 18 categories, subcategories for plumbing, cleaning, electrical and AC, Nigeria and its 36 states plus FCT. No demo users, reviews or transactions.
- Subscription plans: `professional` and `business` exist but are inactive with no price until a pricing strategy is set.

## Verified in this build
- All 8 migrations and the seed apply cleanly on PostgreSQL 16; 66 of 66 smoke checks pass (privilege escalation, self-approval, cross-user access, forged payments, illegal transitions, immutable quotations, review eligibility, audit append-only, suspension delisting).
- `tsc --noEmit` clean, 6 unit tests pass, `next build` succeeds.

## Not verified yet (be aware)
- Tests ran on plain Postgres with stubbed `auth` and `storage` schemas, not the Supabase CLI stack. Run `10_smoke.sql` on your local Supabase before relying on it. Storage policies and the Realtime publication are untested.
- `supabase/config.toml` is not included; `supabase init` generates it.
- No repository existed in this chat, so nothing was inspected or preserved. Stage 1 is delivered as a fresh project to merge into yours.
- Playwright test written, not run. Types are hand-written in `src/lib/domain.ts`; run `npm run db:types` to generate exact ones.
- Customer email/phone verification relies on Supabase Auth settings; phone OTP is a stub boundary.

## Remaining dependencies before later stages
Supabase project; domain (`deca.ng`) and email sender (Resend); Paystack account and a decision on commercial and legal arrangements for protected payments; identity/OTP vendors (later); NDPA review of consent and retention wording; real category verification policy and commission rates from the business.

## Open questions for review
Commission and customer fee values; which documents are mandatory for which trade; review moderation policy; quotation validity default (7 days assumed); whether one conversation per customer-professional pair is right (assumed).

## Refinement round (security review)
- Added migrations 0009 to 0012 instead of editing 0001 to 0008, so history stays reviewable.
- Approval now needs individually accepted documents; badges are derived from accepted documents, never stored flags.
- Clients and administrators cannot hard-delete evidence; erasure is a deliberate service-role operation (NDPA process to be defined).
- Public discovery is view-only; conversation partners see names, not `profiles`.
- A payment can be marked succeeded only with server verification fields; payouts and custody are guarded by a super-admin flag.
- Test-suite findings fixed: seed duplication (migration 0012); test-only artifacts (single transaction flag carry-over, expression ordering) corrected in the tests, not by loosening controls.
- Still open: admin file-access logging and MFA (Stage 8), rate limiting, malware scanning, erasure procedure, Supabase-stack re-run of the DB suite.

## Stage 2 decisions
- Search lives in one SQL function so filtering, ranking and pagination are consistent, indexable and testable; the app only maps validated URL input to its arguments.
- "Recommended" is deliberately simple and explainable (verification, completed jobs, review-weighted rating) and ignores payment; revisit with real data.
- Availability filter means "has working hours today and no day off" (Lagos time); it does not check live bookings (Stage 6).
- Location selection stored in a cookie (no account needed); signed-in preference storage can come with customer profiles.
- Profile contact actions are real links for visitors and honest "coming soon" states for signed-in customers until Stage 6.
- Not included: sitemap and robots, ratings breakdown chart, review pagination beyond the latest ten, portfolio lightbox, geolocation/maps, photography.
