-- DECA Stage 3 | 0014 | onboarding: policy acceptance, consent at sign-up, applicable requirements
-- Adds ONE new table. Everything else Stage 3 needs already exists (profiles, businesses, services, coverage, documents...).

-- Policies are versioned configuration. Bumping the version forces re-acceptance before the next submission.
insert into public.platform_settings(key, value, description, is_public) values
 ('policies', '{"version":"2026-11-24","professional_required":["professional_terms","marketplace_rules","verification_policy","transaction_policy","privacy_policy","dispute_policy"],"customer_required":["privacy_policy"]}',
  'Policy keys users must accept and the current version. Texts are DRAFT until legal review.', true)
on conflict (key) do nothing;

create table public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_key text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, policy_key, version)
);
alter table public.policy_acceptances enable row level security;
create policy acceptances_read on public.policy_acceptances for select using (user_id = auth.uid() or public.is_admin());
revoke all on public.policy_acceptances from anon, authenticated;
grant select on public.policy_acceptances to authenticated;   -- explicit: tables created after 0007 do not inherit its grants   -- written only by accept_policies() and the sign-up trigger
create trigger acceptances_append_only before update or delete on public.policy_acceptances
  for each row execute function public.block_mutation_unless_service();

create or replace function public.current_policy_version() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value ->> 'version' from public.platform_settings where key = 'policies'), '0') $$;

create or replace function public.required_policies_for(p_role public.user_role) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array(select jsonb_array_elements_text(value -> case when p_role = 'professional' then 'professional_required' else 'customer_required' end)
                          from public.platform_settings where key = 'policies'), '{}') $$;

create or replace function public.has_accepted_required_policies(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from unnest(public.required_policies_for((select role from public.profiles where id = p_user))) k
     where not exists (select 1 from public.policy_acceptances a where a.user_id = p_user and a.policy_key = k and a.version = public.current_policy_version())) $$;

create or replace function public.accept_policies(p_keys text[]) returns void
language plpgsql security definer set search_path = public as $$
declare k text; req text[];
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  req := public.required_policies_for(public.current_user_role());
  foreach k in array coalesce(p_keys, '{}') loop
    if not (k = any(req)) then raise exception 'unknown policy %', k; end if;
    insert into public.policy_acceptances(user_id, policy_key, version) values (auth.uid(), k, public.current_policy_version()) on conflict do nothing;
  end loop;
end $$;

-- Sign-up hook: still only customer or professional; now also records consent and an optional starting location.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.user_role := 'customer'; loc uuid; consent boolean := coalesce(new.raw_user_meta_data ->> 'privacy_consent', '') = 'true';
begin
  if new.raw_user_meta_data ->> 'role' = 'professional' then r := 'professional'; end if;
  select id into loc from public.locations where id = public.try_uuid(new.raw_user_meta_data ->> 'location_id') and is_active;
  insert into public.profiles (id, role, full_name, email, phone, location_id)
  values (new.id, r, left(coalesce(new.raw_user_meta_data ->> 'full_name',''), 120), new.email,
          coalesce(nullif(new.phone, ''), left(nullif(new.raw_user_meta_data ->> 'phone', ''), 20)), loc);
  if r = 'customer' then
    insert into public.customer_profiles(user_id, preferred_location_id, marketing_consent, privacy_consent_at)
    values (new.id, loc, coalesce(new.raw_user_meta_data ->> 'marketing_consent', '') = 'true', case when consent then now() end);
  end if;
  if consent then
    insert into public.policy_acceptances(user_id, policy_key, version) values (new.id, 'privacy_policy', public.current_policy_version()) on conflict do nothing;
  end if;
  return new;
end $$;

-- Submission now also requires the professional policies to be accepted (replaces the 0009 definition).
create or replace function public.submit_verification_application() returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; aid uuid; st public.verification_status; missing int;
begin
  select id into pid from public.professional_profiles where user_id = auth.uid() and deleted_at is null;
  if pid is null then raise exception 'professional profile required'; end if;
  if not public.has_accepted_required_policies(auth.uid()) then raise exception 'accept the professional policies before submitting'; end if;
  insert into public.verification_applications(professional_id) values (pid) on conflict (professional_id) do nothing;
  select id, status into aid, st from public.verification_applications where professional_id = pid;
  if st not in ('not_started','incomplete','additional_information_required') then
    raise exception 'application cannot be submitted from status %', st; end if;
  select count(*) into missing from public.required_documents_for(pid) r
   where not exists (select 1 from public.professional_documents d
                      where d.professional_id = pid and d.requirement_id = r.id and d.deleted_at is null
                        and d.uploaded_at is not null and d.review_status <> 'rejected');
  if missing > 0 then raise exception '% required document(s) still missing or not uploaded', missing; end if;
  perform public.internal_flag_on();
  update public.professional_documents set application_id = aid where professional_id = pid and application_id is null and deleted_at is null;
  update public.verification_applications set status = 'submitted', submitted_at = now() where id = aid;
  insert into public.verification_events(application_id, actor_id, event_type, from_status, to_status)
    values (aid, auth.uid(), 'submitted', st, 'submitted');
  return aid;
end $$;

-- Every requirement (required and optional) that applies to this professional, so the UI can list them all.
create or replace function public.applicable_requirements(p_professional uuid)
returns setof public.verification_requirements language sql stable security definer set search_path = public as $$
  select r.* from public.verification_requirements r
   join public.professional_profiles p on p.id = p_professional
  where r.is_active
    and (r.applies_to_account_type is null or r.applies_to_account_type = p.account_type)
    and (r.category_id is null or r.category_id = p.primary_category_id
         or r.category_id in (select category_id from public.professional_services s where s.professional_id = p.id and s.deleted_at is null))
    and (p.user_id = auth.uid() or public.is_admin() or public.is_service_role())
  order by r.sort_order $$;

-- Public image bucket: images only, 5 MB.
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'public-media';

do $$ declare f text; begin
  foreach f in array array['accept_policies(text[])','applicable_requirements(uuid)','has_accepted_required_policies(uuid)','required_policies_for(public.user_role)','current_policy_version()']
  loop execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated, service_role', f); end loop;
end $$;
grant execute on function public.current_policy_version() to anon;
