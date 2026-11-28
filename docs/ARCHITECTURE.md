# DECA architecture (Stage 1, revised after security review)

One Next.js 15 app (App Router, TypeScript, Tailwind) on Vercel, one Supabase project (Postgres, Auth, Storage, Realtime).
Three experiences share one backend: customer (`/account`), professional (`/workspace`), admin (`/admin`). Public discovery (Stage 2) is anonymous.

## Layers
| Layer | Location | Rule |
|---|---|---|
| Routes and UI | `src/app`, `src/components` | No business rules. Calls server code. |
| Server logic | `src/server/*` | Authorisation, validation (Zod), payment and verification adapters. |
| Data access | `src/lib/supabase/*` | `server.ts` acts as the user (RLS applies). `service.ts` bypasses RLS: webhooks and admin jobs only. |
| Database | `supabase/migrations` | Source of truth for schema, RLS, workflows. Versioned SQL. |

## Roles and authentication
Roles: `customer`, `professional`, `admin`, `super_admin` in `profiles.role`. Supabase Auth owns credentials and email verification.
- Sign-up metadata can select only `customer` or `professional`. Admin roles are granted by a super admin or the service role (trigger enforced).
- Users cannot change `role` or `status` (trigger `protect_profile_columns`).
- Access is checked three times: middleware (`src/middleware.ts`), the role layout (`requireRole`), and Row Level Security.

## Data model (35+ tables, all RLS enabled, default deny)
- Identity: `profiles`, `customer_profiles`, `user_addresses`, `locations` (country > state > city > neighbourhood, data not code).
- Catalogue: `service_categories`, `service_subcategories`, `professional_profiles`, `businesses`, `professional_services`, `service_locations` (multi-location coverage), `professional_availability`, `availability_exceptions`, `portfolio_items`, `portfolio_media`.
- Verification (configurable): `verification_requirements` (per category or baseline, editable by admins), `verification_applications`, `professional_documents`, `verification_events`.
- Marketplace: `conversations`, `conversation_participants`, `messages`, `message_attachments`, `saved_professionals`, `bookings`, `booking_transitions`, `booking_events`, `job_updates`, `booking_change_requests`, `quotations`, `quotation_items`, `quotation_revisions`, `reviews`, `review_responses`, `review_reports`, `disputes`, `dispute_evidence`, `notifications`.
- Money and platform: `payment_transactions`, `payment_events`, `ledger_entries` (append-only), `commissions`, `payout_accounts`, `payouts`, `refunds`, `subscription_plans`, `subscriptions`, `platform_settings`, `admin_audit_logs` (append-only).
- Money is `bigint` kobo. Commission is basis points from `platform_settings`; `null` means "not configured", so nothing is recorded.

## Security model
1. Default deny: RLS enabled on every public table; policies open only what each role needs.
2. Writes that carry business rules go through `SECURITY DEFINER` functions (`request_quotation`, `send_quotation`, `approve_quotation`, `reject_quotation`, `transition_booking`, `raise_dispute`, `submit_verification_application`, `review_verification`). Clients have no direct write access to bookings, payments, ledger, commissions, payouts, refunds, notifications or logs.
3. Protected columns (verification status, listing, ratings, completed jobs, review decisions) are guarded by triggers and a transaction-local `deca.internal` flag set only inside those functions.
4. Booking transitions are rows in `booking_transitions` (from, to, actor). Illegal moves raise errors. Accepted quotations and the agreed scope and amount are immutable.
5. Documents live in private buckets; reviewers get signed URLs generated server-side. Message and dispute files are path-scoped to participants. Only `public-media` is public. See *Verification evidence protection* below.
6. Payments: see *Payment trust* below.
7. Admin actions on sensitive tables are written to `admin_audit_logs` by trigger.
8. Full bank account numbers are not stored: only last four digits and the provider recipient code.

## Payments
`PaymentProvider` interface (`src/server/payments/types.ts`), Paystack adapter, registry returning an explicit "unavailable" state. `custody_mode` defaults to `none`. `PROTECTED_PAYMENTS_ENABLED=false` until a partner and legal structure are confirmed. No UI may describe funds as held in escrow while it is false.

## Design system
Tokens in `tailwind.config.ts` and `src/app/globals.css` (forest `#0f4a38`, mint `#bff0d6`, canvas, ink, line, status colours, radii `card/control/sheet`, soft shadows, Manrope). Primitives: `Button`, `Input`, `Badge`, `VerificationBadge`, `BookingBadge`.

## Folder structure
```
supabase/{migrations,seed.sql,tests}   schema, RLS, workflows, reference data, tests
src/app/{(auth),(customer),(professional),(admin),api,auth}
src/components/ui                      design system primitives
src/lib/{supabase,env,domain,money}    shared infrastructure
src/server/{auth,payments,verification} server-only logic
tests/e2e                              Playwright
docs/
```

## Public discovery layer (migration 0010)
Discovery never reads base tables. Anonymous and signed-in visitors read six views: `public_professionals`, `public_professional_services`, `public_service_coverage`, `public_portfolio`, `public_reviews`, `public_availability`.
- Views are owner-privileged with `security_barrier`, list columns explicitly, and filter to approved + listed + active professionals. A column added to a table later is not exposed until a migration adds it to a view.
- Not exposed anywhere public: email, phone, `user_id`, business registration number, business email/phone/address, documents, notes, decision reasons, bank data, customer ids. Business shows only its registered name and logo. Reviewers appear as first name plus initial.
- Verification badges (`identity_verified`, `credentials_verified`, `experience_verified`) are derived from documents an administrator individually accepted; they are never stored flags a professional can influence.
- Sponsored listings carry `is_sponsored` so the UI can label them.
- Base-table anon grants are revoked. Signed-in users reach only their own rows (RLS). Conversation partners no longer read each other's `profiles` row: `conversation_parties` returns display name and avatar only.
- Application rule: `src/lib/public-views.ts` lists the views and the private tables; a unit test fails if UI, component or shared-lib code queries a private base table or imports the service client.

## Verification evidence protection (migration 0009)
- Owners upload, view, and may soft-remove a document only while the application is `not_started`, `incomplete` or `additional_information_required`, and never once it is accepted.
- After submission (`submitted`, `under_review`, `approved`, `rejected`, `suspended`) owners cannot modify or remove anything. File name, path, size, type, requirement and professional are immutable for everyone except the service role. There is no hard delete for clients or administrators; administrators decide only through `review_document` and `review_verification`, which write to the append-only `verification_events`.
- Approval requires every required document to be accepted individually.
- Storage: an upload is accepted only against a pending record the uploader owns (`document_upload_allowed`); there is no update or delete policy on the bucket, so files cannot be overwritten or removed by clients. `confirm_document_upload` marks the record uploaded only after the file exists in storage; submission requires confirmed uploads. Bucket limits: 10 MB; JPEG, PNG, PDF.
- Consistency: rows are never hard-deleted by clients, files cannot be deleted by clients, and `reconcile_verification_files()` (admin or service role) reports `record_without_file`, `file_without_record` and `upload_not_confirmed`. Deliberate erasure (for example an NDPA request) is a server-side service-role action.

## Payment trust (migration 0011, `src/server/payments`)
- Browsers and webhook bodies are never evidence of payment. `payment_transactions` has no client write grants. The database refuses `succeeded` (and later refund states) unless `verified_at`, `verified_amount_minor` and `verified_currency` match the transaction, which only server code with provider verification can supply (`isPaymentConfirmed`).
- Status transitions are enforced (`initiated` to `pending` to `succeeded` to refunds; no going back); amount, currency and references are immutable.
- Webhooks: `handleWebhook` checks size, then signature on the raw body, then JSON, then shape, then records through `record_payment_event`, which is replay-safe on `(provider, provider_event_id)`. It never changes payment status. Malformed input returns 4xx; recording failures return a controlled 500 so the provider retries safely.
- Settlement and protected payments stay disabled: `payment_transactions.custody_mode` must be `none` and `payouts` cannot be inserted or updated unless `platform_settings.features.protected_payments_enabled` is set by a super admin. No UI may describe escrow while it is false.

## Folder structure (additions)
```
scripts/test-db.sh             reproducible database verification (throwaway Postgres)
supabase/tests/{00,05,10,20}   stubs, helpers, workflow/RLS tests, hardening tests
docs/{ARCHITECTURE,SECURITY,TESTING,SETUP,DECISIONS}.md
```

## Stage 2: public marketplace (migration 0013, `src/app/(public)`)
**Routes:** `/` home, `/explore` search and filters, `/categories/[slug]` (resolves the category, then shows the filtered explore view), `/professionals/[slug]` public profile (shareable URL, per-profile metadata), `/api/locations` (public location reference data), `/status` (developer status page, moved from `/`).

**Data path.** Pages call `src/server/discovery/queries.ts` only. It reads the public views, the `search_professionals` RPC and `public_category_counts` with explicit column lists. The RPC is `SECURITY DEFINER` but selects only from the public views and returns a fixed, non-private column set. It handles: text search (name, business, service, category, full-text; LIKE wildcards escaped), category and subcategory, location, minimum rating, verification level, minimum experience, maximum starting price, available today (Africa/Lagos, honouring days off), five sort orders, and clamped pagination with a stable total.
- Location matching is hierarchical: a state-wide professional matches a city search; a neighbourhood-level professional matches the city above it.
- `recommended` ranks by verification, completed jobs and review-weighted rating. Sponsorship does not affect order (tested); sponsored results are labelled.
- A professional with no reviews shows "New on DECA", never stars or a zero rating.

**Untrusted input.** URL parameters are parsed by `parseDiscoveryParams` (Zod); invalid values are dropped. Location and recently-viewed cookies are validated on read. The price filter is entered in naira and converted to kobo.

**Customer actions.** Save/unsave is a server action restricted to customers, only for professionals visible in the public view, and limited to the caller's rows by RLS. "Contact Professional" and "Request Service" send visitors to sign in; signed-in customers see them disabled with a "coming soon" note until Stage 6 (messaging, quotations). No button silently does nothing.

**Location selection.** Header dialog (state, city, neighbourhood) stores a validated cookie; `/explore` uses it unless `l` is present in the URL (`l=` means anywhere). A field variant drives the filter form.

**Imagery.** No photographs are bundled. Profiles use uploaded avatars and portfolio media from the public bucket, with initials and gradient fallbacks. Real photography of professionals at work must be added before launch.

**Mobile.** Bottom navigation with a raised central "Request Service" action (currently opens Explore), dialog-based location picker, filters collapsible, touch-sized controls.

**Dev data.** `supabase/seed.demo.sql` creates six clearly labelled `[DEMO]` professionals with no reviews, no ratings and no verification badges. It refuses to run unless `deca.allow_demo_seed` is set in the same session.

## Stage 3: authentication and onboarding (migration 0014; see STAGE3.md)
- **Auth flows** live in `src/server/auth` (actions, schemas) and `src/components/auth-form.tsx`. Sign-up passes role, location and consent as user metadata; the `handle_new_user` trigger (the only place roles are assigned at sign-up) limits the role to customer or professional, validates the location, and records consent and the privacy-policy acceptance.
- **Onboarding** is seven step routes under `/workspace/onboarding/[step]`. Pure progress logic (`src/lib/onboarding-steps.ts`) is unit tested; data comes from one query (`src/server/onboarding/queries.ts`); writes are server actions (`actions.ts`) that validate with Zod, then write through the user's own Supabase session so RLS decides. Database errors are mapped to safe messages (our own `RAISE EXCEPTION` texts pass through; everything else is generic).
- **Uploads:** `createDocumentRecord` (server: validates, creates the row, returns a path) then browser upload then `confirmDocumentUpload` (database checks the object exists). Public images (avatar, portfolio) upload to the user's own folder in `public-media` and are registered by actions that verify the path prefix.
- **Server-only secrets:** `src/lib/env-server.ts` is the only module that reads the secret key; `server-only` makes importing it from client code a build error. Stage 3 never calls the service-role client.
- **Policy acceptance:** versioned in `platform_settings.policies`; bumping the version forces re-acceptance before the next submission.
- **Admin review (minimal):** `src/server/admin/verification.ts` wraps the existing `review_document` and `review_verification` functions; reviewers open files through 60-second signed URLs.

## Admin verification and professional management
See docs/ADMIN_VERIFICATION.md. Pages: `src/app/(admin)/admin/verification` (views, search, filters) and `[id]` (detail). Components: `src/components/admin/*`. Data: `src/server/admin/queries.ts` (one RPC for the list, one for counts, separate reads for detail). Filter parsing and history wording: `src/lib/admin-verification.ts` (unit tested). Migration 0015.

## Stage 4: professional workspace
See docs/WORKSPACE.md. Routes `src/app/(professional)/workspace/*`; navigation `src/components/workspace/nav.tsx`; reads in `src/server/workspace/queries.ts`; writes in `src/server/workspace/actions.ts` (all through the user's own session, so RLS applies); pure logic in `src/lib/workspace.ts` (unit tested). Onboarding step components are reused in `manage` mode. Migration 0016.
