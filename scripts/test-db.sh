#!/usr/bin/env bash
# Reproducible database verification on a THROWAWAY database in plain PostgreSQL 15+.
#   ADMIN_PSQL="psql -U postgres -h localhost" bash scripts/test-db.sh
# (In the sandbox this was run as: su postgres -c "bash scripts/test-db.sh")
# Do NOT point this at a Supabase project: 00_local_stubs.sql fakes the auth and storage schemas.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB_NAME:-deca_test}"
ADMIN="${ADMIN_PSQL:-psql}"
$ADMIN -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { echo "-- $1"; $ADMIN -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" 2>&1 | grep -v -E "NOTICE:  (PASS|schema .* already exists)" || true; }
check() { $ADMIN -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" 2>&1 | grep -E "NOTICE:  FAIL|ERROR|passed|^ +[0-9]+ \|" || true; }
run supabase/tests/00_local_stubs.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
run supabase/seed.sql   # seed must be idempotent
echo "== seed counts (expect 18|38|5: 18 categories, 38 locations, 2 baseline + 3 optional requirements)"
$ADMIN -At -d "$DB" -c "select (select count(*) from public.service_categories), (select count(*) from public.locations), (select count(*) from public.verification_requirements)"
run supabase/tests/05_test_helpers.sql
echo "== smoke (RLS + workflows)"; check supabase/tests/10_smoke.sql
echo "== hardening (evidence, storage, public views, payments)"; check supabase/tests/20_hardening.sql
echo "== discovery (Stage 2 search)"; check supabase/tests/30_discovery.sql
echo "== onboarding (Stage 3)"; check supabase/tests/40_onboarding.sql
echo "== demo seed: refused without the guard, idempotent with it, no fake reviews/badges"
if $ADMIN -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/seed.demo.sql >/dev/null 2>&1; then echo "FAIL demo seed ran without guard"; exit 1; else echo "guard OK (refused)"; fi
for i in 1 2; do $ADMIN -q -v ON_ERROR_STOP=1 -d "$DB" -c "set deca.allow_demo_seed = 'on'" -f supabase/seed.demo.sql; done
$ADMIN -At -d "$DB" -c "select 'demo professionals public=' || count(*) || ' with_reviews=' || count(*) filter (where review_count > 0) || ' with_badges=' || count(*) filter (where identity_verified or credentials_verified or experience_verified) from public.public_professionals where display_name like '[DEMO]%'"
$ADMIN -At -d "$DB" -c "select 'TOTAL passed=' || count(*) filter (where ok) || ' failed=' || count(*) filter (where not ok) from t.results"
$ADMIN -At -d "$DB" -c "select count(*) from t.results where not ok" | grep -qx 0
