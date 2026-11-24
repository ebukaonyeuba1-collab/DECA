-- NOTE: each helper call models one separate client request, so the transaction-local 'deca.internal' flag
-- is cleared around it (PostgREST runs one RPC per transaction in production).
-- Shared test helpers: run an SQL statement as a given identity and record PASS/FAIL.
create schema if not exists t;
create table if not exists t.results(label text, ok boolean);
create or replace function t.as_(p_uid uuid, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, false);
  execute format('set role %I', p_role);
end $$;
create or replace function t.try(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $$
begin perform set_config('deca.internal','',true); perform t.as_(p_uid, p_role); execute p_sql; reset role; perform set_config('deca.internal','',true); return 'ok';
exception when others then reset role; perform set_config('deca.internal','',true); return sqlerrm; end $$;
create or replace function t.val(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $$
declare v text;
begin perform set_config('deca.internal','',true); perform t.as_(p_uid, p_role); execute p_sql into v; reset role; perform set_config('deca.internal','',true); return v;
exception when others then reset role; perform set_config('deca.internal','',true); return 'ERR: ' || sqlerrm; end $$;
create or replace function t.check(p_label text, p_ok boolean) returns void language plpgsql as $$
begin insert into t.results values (p_label, coalesce(p_ok, false)); raise notice '% %', case when coalesce(p_ok,false) then 'PASS' else 'FAIL' end, p_label; end $$;
create or replace function t.fails(p_res text) returns boolean language sql as $$ select p_res <> 'ok' and p_res not like 'ok%' $$;

