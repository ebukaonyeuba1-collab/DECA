# Testing and verification

Everything below is reproducible. Results are from the environment where this build was produced: Node 22, PostgreSQL 16.15, Next.js 15.5. No Docker or Supabase CLI was available there.

## Commands
| What | Command | Needs |
|---|---|---|
| Install | `npm install` | Node 20+ |
| Migrations, seed (run twice), RLS, workflow, hardening tests | `ADMIN_PSQL="psql -U postgres -h localhost" bash scripts/test-db.sh` | PostgreSQL 15+, a superuser; uses throwaway DB `deca_test` |
| Type check | `npm run typecheck` | |
| Unit tests | `npm test` | |
| Production build | `npm run build` | |
| All app checks | `npm run verify` | |
| Route guards (E2E) | `npx playwright install && npm run test:e2e` | running app, Supabase |

`scripts/test-db.sh` drops and recreates the database, applies `supabase/tests/00_local_stubs.sql` (fake `auth` and `storage` schemas, plain Postgres only), all 14 migrations in order, `seed.sql` twice (idempotency), then the test files and a demo-seed check. It exits non-zero on any failure.

## Results actually executed
| Check | Result |
|---|---|
| 12 migrations apply cleanly from empty | Pass |
| Seed applies twice with identical counts (18 categories, 38 locations, 5 requirements) | Pass (this run found and fixed a duplication bug: NULL parents defeat a plain UNIQUE; fixed by migration 0012 and a seed rewrite) |
| `10_smoke.sql` workflow and RLS | 74 of 74 |
| `20_hardening.sql` evidence, storage, public views, payments | 85 of 85 (159 of 159 cumulative) |
| `tsc --noEmit` | Clean |
| Vitest | 18 tests, 5 files, all passing |
| `next build` | Succeeds; role pages dynamic; middleware compiled |
| Route guards on a running build (no Supabase configured) | `/admin`, `/account`, `/workspace` redirect to `/`; `/` returns 200 |
| Webhook over HTTP (running build, fake DB URL) | no signature 401; forged 401; malformed JSON 400; empty body 400; wrong shape 400; missing id 400; valid but DB unreachable 500 with a controlled JSON body; 0 unhandled errors in the server log |

## Not verified
- Anything on a real Supabase stack: Supabase Auth, real `storage` schema and policies, Realtime, PostgREST exposure of views and RPCs, email confirmation. The stand-ins mimic `auth.uid()`, `auth.jwt()`, `storage.foldername()` only.
- Webhook against a real Paystack sandbox event; `initialize` and `verify` network calls (the adapter is unit-tested for signatures only).
- Webhook 503 path when no provider key is configured: covered by code reading, not exercised live (the live attempt did not return).
- Playwright E2E: written, never run.
- Browser rendering, accessibility, performance, load, and concurrency (for example two simultaneous approvals).
- The 66-check suite from the first delivery has been superseded; its checks were kept and updated inside the 74.

## Reading a failure
Each check prints `NOTICE: PASS|FAIL <label>`; failures are also listed at the end of each suite.

## Stage 2 results (executed)
| Check | Result |
|---|---|
| 14 migrations apply from empty; seed twice | Pass |
| `10_smoke` 74, `20_hardening` 85, `30_discovery` 30 | 189 of 189 |
| Demo seed: refused without guard; idempotent with it; 6 public demo professionals, 0 reviews, 0 badges | Pass |
| `tsc --noEmit` | Clean |
| Vitest | 26 tests, 6 files, passing (params, cookies, pricing, media, webhook, signatures, private-table guard) |
| `next build` | Succeeds; 14 routes |
| Running build, no Supabase env | All pages 200 with a "not connected" notice; bad slug and unknown category 404; `/api/locations` 503, invalid parent 400 |
| Running build, Supabase unreachable | Pages 200 with a friendly error state, profile 404 for malformed slug, API 503, 0 unhandled errors |

Stage 2 database checks cover: only approved and listed professionals appear; category and subcategory filters; name, service and category text matching; wildcard and hostile text; state, city and neighbourhood location matching; rating, experience, price, verification and availability filters (including a day off); sorting; sponsorship not changing recommended order; pagination clamps and stable totals; invalid sort values; no private columns in the function result; category counts.

## Stage 2 not verified
- **No page was rendered against real data.** There was no Supabase or PostgREST in the build environment, so the supabase-js calls (`rpc`, view selects, the `service_subcategories` embed in `listCategories`, `saved_professionals`) are type-checked but not executed. The SQL behind them is tested. Run the app against local Supabase with the demo seed and walk through: home, explore with filters, a profile, save, and the location dialog.
- Visual design, responsive layout, accessibility (keyboard, screen reader, contrast) and performance were not inspected in a browser.
- The location dialog and filters were not exercised with JavaScript running.
- Behaviour with a down database: each page takes about 7 seconds to show its error state (client retries). Acceptable for dev; consider request timeouts before launch.
- Playwright tests exist for route guards only; no Stage 2 end-to-end tests yet.

## Stage 3 results (executed in the build environment)
| Check | Result |
|---|---|
| 14 migrations apply from empty; seed twice; demo seed guard | Pass |
| Database suites: smoke 75, hardening 85, discovery 30, onboarding 26 | 216 of 216 |
| `90_remote_readonly_checks.sql` syntax and logic on the test database | Runs; 19 of 20 true (the 20th, demo data, is expected false there) |
| `tsc --noEmit` | Clean |
| Vitest | 50 tests, 9 files, passing (adds: redirect safety, slugs, uploads, naira parsing, schemas, onboarding progress, client/server safety guards) |
| `next build` | Succeeds; 22 routes |
| Canary build: secret values and secret variable names in browser bundle | 0 and 0; publishable key inlined |
| Running build without Supabase: auth pages 200; `/account`, `/workspace`, `/admin`, admin pages redirect to sign-in with a safe `next`; `/reset-password` without a session redirects; unknown policy 404; 0 unhandled errors | Pass |

Findings fixed during Stage 3 testing: a new table needed explicit grants (it would have worked on Supabase only through default privileges); a `javascript:` website URL passed validation (now http/https only); secret variable names sat in a shared module (moved to a server-only module); an email-link error message was misleading for already-confirmed users.

## Stage 3 NOT verified
- **No test touched a real Supabase project.** Sign-up, email confirmation, sign-in, password reset, session cookies, direct browser uploads, signed URLs, and the Realtime/PostgREST exposure of the new functions are untested. The database logic behind them is tested.
- No page was rendered with a signed-in session; forms were not exercised in a browser; accessibility and visual design not inspected.
- The storage tests used a stand-in `storage` schema; the read-only script and acceptance scenarios in STAGE3.md exist to close this gap on the real project.
- Playwright tests cover route guards only.
