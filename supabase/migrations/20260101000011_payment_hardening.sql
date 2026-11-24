-- DECA Stage 1 refinement | 0011 | payment trust, replay safety, settlement kept off

create or replace function public.protected_payments_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value ->> 'protected_payments_enabled' from public.platform_settings where key = 'features') = 'true', false) $$;

-- A payment can only be marked successful with server-side provider verification evidence.
alter table public.payment_transactions
  add column verified_at timestamptz,
  add column verified_amount_minor bigint,
  add column verified_currency char(3);
alter table public.payment_transactions add constraint payment_success_requires_server_verification check (
  status not in ('succeeded','partially_refunded','refunded')
  or (verified_at is not null and verified_amount_minor = amount_minor and verified_currency = currency));

create or replace function public.guard_payment_transaction() returns trigger language plpgsql as $$
begin
  if new.custody_mode <> 'none' and not public.protected_payments_enabled() then
    raise exception 'protected payments are disabled: custody_mode must be none';
  end if;
  if tg_op = 'UPDATE' then
    if new.amount_minor <> old.amount_minor or new.currency <> old.currency or new.provider_reference <> old.provider_reference
       or new.booking_id <> old.booking_id or new.customer_id <> old.customer_id or new.professional_id <> old.professional_id then
      raise exception 'payment identity and amount are immutable';
    end if;
    if new.status is distinct from old.status and not (
         (old.status = 'initiated' and new.status in ('pending','succeeded','failed','abandoned'))
      or (old.status = 'pending' and new.status in ('succeeded','failed','abandoned'))
      or (old.status = 'succeeded' and new.status in ('partially_refunded','refunded'))
      or (old.status = 'partially_refunded' and new.status = 'refunded')) then
      raise exception 'illegal payment status change % to %', old.status, new.status;
    end if;
  end if;
  return new;
end $$;
create trigger payments_guard before insert or update on public.payment_transactions
  for each row execute function public.guard_payment_transaction();

-- Settlement (payouts) stays off until protected payments are enabled by a super admin.
create or replace function public.guard_payout() returns trigger language plpgsql as $$
begin
  if not public.protected_payments_enabled() then raise exception 'payouts are disabled until protected payments are enabled'; end if;
  return new;
end $$;
create trigger payouts_guard before insert or update on public.payouts for each row execute function public.guard_payout();

-- Replay-safe event recording: returns true for a new event, false for a replay.
create or replace function public.record_payment_event(p_provider text, p_event_id text, p_event_type text, p_signature_valid boolean, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_service_role() then raise exception 'service role only'; end if;
  insert into public.payment_events(provider, provider_event_id, event_type, signature_valid, payload)
    values (p_provider, p_event_id, p_event_type, p_signature_valid, p_payload)
    on conflict (provider, provider_event_id) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.record_payment_event(text, text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.record_payment_event(text, text, text, boolean, jsonb) to service_role;
