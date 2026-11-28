-- DECA Stage 4 | 0016 | professional workspace
-- Adds one small table (private customer notes), one guard (sensitive profile changes after approval) and two read-only
-- functions. Everything else the workspace shows already exists and is protected by the existing RLS policies.

-- ---------- private customer notes (visible only to the professional who wrote them) ----------
create table if not exists public.professional_customer_notes (
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (professional_id, customer_id)
);
alter table public.professional_customer_notes enable row level security;
-- Only for customers the professional has actually dealt with; no admin policy: notes are the professional's own.
drop policy if exists notes_owner on public.professional_customer_notes;
create policy notes_owner on public.professional_customer_notes for all
  using (public.owns_professional(professional_id))
  with check (public.owns_professional(professional_id)
              and exists (select 1 from public.bookings b where b.professional_id = professional_customer_notes.professional_id and b.customer_id = professional_customer_notes.customer_id));
revoke all on public.professional_customer_notes from anon, authenticated;
grant select, insert, update, delete on public.professional_customer_notes to authenticated;
drop trigger if exists set_updated_at on public.professional_customer_notes;
create trigger set_updated_at before update on public.professional_customer_notes for each row execute function public.set_updated_at();

-- ---------- sensitive changes after approval send the profile back to review ----------
-- Changing the account type, main category or the registered business identity changes what must be verified.
-- The professional is unlisted until an administrator decides again; the change is recorded in the history.
create or replace function public.reverify_after_sensitive_change(p_professional uuid, p_what text) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid;
begin
  select id into aid from public.verification_applications where professional_id = p_professional and status = 'approved';
  if aid is null then return; end if;
  perform public.internal_flag_on();
  update public.verification_applications set status = 'under_review' where id = aid;   -- existing sync trigger unlists the profile
  insert into public.verification_events(application_id, actor_id, event_type, from_status, to_status, message)
    values (aid, auth.uid(), 'sensitive_change', 'approved', 'under_review', 'Professional changed their ' || p_what || '. Review whether documents still apply, then decide again.');
end $$;
revoke all on function public.reverify_after_sensitive_change(uuid, text) from public, anon, authenticated;

create or replace function public.trg_profile_sensitive_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or public.is_service_role() then return null; end if;
  perform public.reverify_after_sensitive_change(new.id, case when new.account_type is distinct from old.account_type then 'account type' else 'main category' end);
  return null;
end $$;
drop trigger if exists pro_sensitive_change on public.professional_profiles;
create trigger pro_sensitive_change after update on public.professional_profiles
  for each row when (old.verification_status = 'approved' and (new.account_type is distinct from old.account_type or new.primary_category_id is distinct from old.primary_category_id))
  execute function public.trg_profile_sensitive_change();

create or replace function public.trg_business_sensitive_change() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if public.is_admin() or public.is_service_role() then return null; end if;
  select id into pid from public.professional_profiles where business_id = new.id and verification_status = 'approved';
  if pid is not null then perform public.reverify_after_sensitive_change(pid, 'registered business name or number'); end if;
  return null;
end $$;
drop trigger if exists business_sensitive_change on public.businesses;
create trigger business_sensitive_change after update on public.businesses
  for each row when (new.registered_name is distinct from old.registered_name or new.registration_number is distinct from old.registration_number)
  execute function public.trg_business_sensitive_change();

-- ---------- dashboard figures (SECURITY INVOKER: row level security applies, so only the caller's own data is counted) ----------
create or replace function public.professional_dashboard() returns jsonb
language sql stable set search_path = public as $$
  with me as (select id, rating_avg, review_count, verification_status from public.professional_profiles where user_id = auth.uid() and deleted_at is null),
       bk as (select b.* from public.bookings b join me on me.id = b.professional_id)
  select coalesce((select jsonb_build_object(
    'professional_id', me.id, 'verification_status', me.verification_status, 'rating_avg', me.rating_avg, 'review_count', me.review_count,
    'enquiries_new', (select count(*) from bk where status = 'quotation_requested'),
    'quotations_draft', (select count(*) from public.quotations q where q.professional_id = me.id and q.status = 'draft'),
    'quotations_pending', (select count(*) from public.quotations q where q.professional_id = me.id and q.status = 'sent'),
    'bookings_upcoming', (select count(*) from bk where status in ('confirmed','awaiting_payment','payment_secured','scheduled')),
    'jobs_active', (select count(*) from bk where status in ('in_progress','awaiting_customer_confirmation')),
    'jobs_completed', (select count(*) from bk where status = 'completed'),
    'unread_messages', (select count(*) from public.messages m join public.conversation_participants cp on cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
                         where m.sender_id <> auth.uid() and m.deleted_at is null and (cp.last_read_at is null or m.created_at > cp.last_read_at)),
    'gross_completed_minor', coalesce((select sum(agreed_amount_minor) from bk where status = 'completed'), 0),
    'commission_minor', coalesce((select sum(c.amount_minor) from public.commissions c join bk on bk.id = c.booking_id), 0),
    'payout_pending_minor', coalesce((select sum(amount_minor) from public.payouts p where p.professional_id = me.id and p.status in ('pending','processing')), 0),
    'payout_paid_minor', coalesce((select sum(amount_minor) from public.payouts p where p.professional_id = me.id and p.status = 'paid'), 0),
    'by_status', coalesce((select jsonb_object_agg(s.status, s.n) from (select status, count(*) n from bk group by status) s), '{}'::jsonb),
    'quotations_sent_total', (select count(*) from public.quotations q where q.professional_id = me.id and q.status <> 'draft')
  ) from me), '{}'::jsonb) $$;

-- ---------- customers the professional has dealt with (names masked: first name and initial; no email or phone) ----------
create or replace function public.professional_customers()
returns table (customer_id uuid, display_name text, bookings_count bigint, completed_count bigint, last_booking_at timestamptz, note text)
language sql stable security definer set search_path = public as $$
  select b.customer_id,
         coalesce(nullif(trim(split_part(trim(u.full_name), ' ', 1) || case when position(' ' in trim(u.full_name)) > 0 then ' ' || left(regexp_replace(trim(u.full_name), '^.*\s', ''), 1) || '.' else '' end), ''), 'Customer'),
         count(*), count(*) filter (where b.status = 'completed'), max(b.created_at), n.note
    from public.bookings b
    join public.professional_profiles pp on pp.id = b.professional_id and pp.user_id = auth.uid()
    join public.profiles u on u.id = b.customer_id
    left join public.professional_customer_notes n on n.professional_id = pp.id and n.customer_id = b.customer_id
   group by b.customer_id, u.full_name, n.note
   order by max(b.created_at) desc $$;

do $$ declare f text; begin
  foreach f in array array['professional_dashboard()','professional_customers()']
  loop execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated, service_role', f); end loop;
end $$;
