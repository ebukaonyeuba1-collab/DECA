# Setup

## Prerequisites
Node 20+, npm, Docker, the Supabase CLI, a Vercel account (deployment), a Paystack test account (optional until Stage 7).

## Local
```bash
npm install
supabase init            # once; keeps the existing supabase/migrations folder
supabase start           # prints the API URL, anon key, service role key, DB URL
cp .env.example .env.local   # fill the three Supabase values from the output above
supabase db reset        # applies migrations, then seed.sql
npm run dev              # http://localhost:3000 shows the foundation status page
```
Add to `supabase/config.toml` if missing so seed runs on reset: `[db.seed] enabled = true, sql_paths = ["./seed.sql"]`.

## Demo data (development only)
```bash
psql "$SUPABASE_DB_URL" -c "set deca.allow_demo_seed = 'on'" -f supabase/seed.demo.sql
```
Run both in one `psql` invocation as shown. Creates six `[DEMO]` professionals with no reviews or badges so the marketplace has content. Never run on production.

## First super admin
Sign up normally, then in the Supabase SQL editor (service role context):
```sql
update public.profiles set role = 'super_admin' where email = 'you@example.com';
```
Roles can never be self-assigned from the app.

## Tests
```bash
npm run verify                                     # typecheck, unit tests, production build
ADMIN_PSQL="psql -U postgres -h localhost" bash scripts/test-db.sh   # throwaway Postgres: migrations, seed, 159 checks
npx playwright install && npm run test:e2e         # route guards, against a running app
```
Run `supabase/tests/05_test_helpers.sql`, `10_smoke.sql` and `20_hardening.sql` against your local Supabase DB as well (skip `00_local_stubs.sql`; never run it on Supabase). See [TESTING.md](TESTING.md) for what has and has not been verified.

## Storage
Migrations `0008` and `0009` create the buckets `public-media`, `verification-documents`, `message-attachments`, `dispute-evidence` with policies. The verification bucket is limited to 10 MB and JPEG/PNG/PDF by migration `0009`; confirm the limits appear in the dashboard.

## Deploy (Vercel)
1. Create a hosted Supabase project; run `supabase link` then `supabase db push`; run `seed.sql` once.
2. Import the repo in Vercel. Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (all environments) and `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY` (server only, never `NEXT_PUBLIC_`).
3. In Supabase Auth settings add the site URL and `/auth/callback` redirect; enable email confirmation.
4. Keep `PROTECTED_PAYMENTS_ENABLED=false`.
