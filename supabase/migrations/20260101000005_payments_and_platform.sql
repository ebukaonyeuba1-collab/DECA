-- DECA Stage 1 | 0005 | payments ledger, payouts, refunds, subscriptions, settings, audit
-- Amounts are bigint minor units (kobo). Nothing here asserts that escrow exists:
-- custody_mode records what the provider arrangement actually is, and defaults to 'none'.

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  quotation_id uuid references public.quotations(id),
  customer_id uuid not null references public.profiles(id),
  professional_id uuid not null references public.professional_profiles(id),
  provider text not null,
  provider_reference text not null unique,
  idempotency_key text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'NGN',
  status public.payment_status not null default 'initiated',
  custody_mode text not null default 'none' check (custody_mode in ('none','provider_held','platform_held')),
  is_sandbox boolean not null default true,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_tx_booking_idx on public.payment_transactions(booking_id);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.payment_transactions(id),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)          -- webhook replay protection
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  transaction_id uuid references public.payment_transactions(id),
  booking_id uuid references public.bookings(id),
  account text not null check (account in ('customer','platform_commission','professional_payable','provider_fees','refund_liability')),
  direction text not null check (direction in ('debit','credit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'NGN',
  memo text,
  created_at timestamptz not null default now()
);
create or replace function public.block_mutation() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger ledger_append_only before update or delete on public.ledger_entries
  for each row execute function public.block_mutation();

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.payment_transactions(id),
  booking_id uuid not null references public.bookings(id),
  rate_bps int not null check (rate_bps between 0 and 10000),
  rule jsonb not null default '{}',               -- which configured rule produced the rate
  amount_minor bigint not null check (amount_minor >= 0),
  created_at timestamptz not null default now()
);
create or replace function public.commission_only_for_completed() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.bookings where id = new.booking_id and status = 'completed') then
    raise exception 'commission can only be recorded for completed bookings'; end if;
  return new;
end $$;
create trigger commissions_completed_only before insert on public.commissions
  for each row execute function public.commission_only_for_completed();

-- Full bank account numbers are NOT stored; only what the payment provider returns.
create table public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null unique references public.professional_profiles(id) on delete cascade,
  bank_name text not null,
  bank_code text,
  account_name text not null,
  account_last4 char(4) not null,
  provider text,
  provider_recipient_code text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id),
  booking_id uuid references public.bookings(id),
  transaction_id uuid references public.payment_transactions(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'NGN',
  status public.payout_status not null default 'pending',
  provider_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.payment_transactions(id),
  booking_id uuid not null references public.bookings(id),
  dispute_id uuid references public.disputes(id),
  amount_minor bigint not null check (amount_minor > 0),
  status public.refund_status not null default 'requested',
  reason text,
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  provider_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  tier public.subscription_tier not null unique,
  name text not null,
  price_minor bigint check (price_minor >= 0),    -- null until a pricing strategy is defined
  currency char(3) not null default 'NGN',
  billing_interval text not null default 'month' check (billing_interval in ('month','year')),
  features jsonb not null default '{}',
  is_active boolean not null default false,       -- paid plans stay inactive until priced
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status public.subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Subscriptions can never alter verification (rule 14): no trigger or policy links them.

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create trigger audit_append_only before update or delete on public.admin_audit_logs
  for each row execute function public.block_mutation();

create or replace function public.audit_row_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or public.is_service_role() then
    insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
    values (auth.uid(), lower(tg_op), tg_table_name,
            coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(new) ->> 'key'), (to_jsonb(old) ->> 'id'), (to_jsonb(old) ->> 'key')),
            case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
            case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  end if;
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['verification_applications','professional_profiles','profiles','service_categories','service_subcategories',
    'verification_requirements','platform_settings','subscription_plans','disputes','refunds','payouts','commissions','professional_documents','reviews']
  loop execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row_change()', t); end loop;
end $$;

-- updated_at on every table that has the column
do $$ declare t text; begin
  for t in select c.table_name from information_schema.columns c join information_schema.tables x
      on x.table_schema = c.table_schema and x.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'updated_at' and x.table_type = 'BASE TABLE'
  loop execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t); end loop;
end $$;
