-- DECA Stage 1 | 0003 | catalogue, professionals, services, coverage, portfolio, verification

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,                       -- Lucide icon name
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.service_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  registered_name text not null,
  registration_number text,
  description text,
  logo_path text,
  address_line text,
  location_id uuid references public.locations(id),
  email text,
  phone text,
  year_established int check (year_established between 1900 and 2100),
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  account_type public.account_type not null default 'individual',
  business_id uuid references public.businesses(id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text not null,
  headline text,
  bio text,
  years_experience int check (years_experience between 0 and 80),
  primary_category_id uuid references public.service_categories(id),
  verification_status public.verification_status not null default 'not_started',
  is_listed boolean not null default false,     -- public discovery gate, set only by DECA
  is_featured boolean not null default false,   -- paid or editorial, always labelled in the UI
  featured_until timestamptz,
  rating_avg numeric(3,2) not null default 0,   -- maintained from real reviews only
  review_count int not null default 0,
  completed_jobs int not null default 0,        -- maintained from completed bookings only
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(display_name,'') || ' ' || coalesce(headline,'') || ' ' || coalesce(bio,''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index pro_listed_idx on public.professional_profiles(primary_category_id) where is_listed and deleted_at is null;
create index pro_search_idx on public.professional_profiles using gin (search_document);
create index pro_name_trgm on public.professional_profiles using gin (display_name extensions.gin_trgm_ops);

create table public.professional_services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  category_id uuid not null references public.service_categories(id),
  subcategory_id uuid references public.service_subcategories(id),
  name text not null,
  description text,
  inclusions text,
  exclusions text,
  pricing_type public.pricing_type not null default 'inspection_based',
  price_minor bigint check (price_minor >= 0),            -- kobo
  minimum_charge_minor bigint check (minimum_charge_minor >= 0),
  additional_charges text,
  duration_minutes int check (duration_minutes > 0),
  currency char(3) not null default 'NGN',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (pricing_type in ('per_project','inspection_based') or price_minor is not null)
);
create index pro_services_pro_idx on public.professional_services(professional_id);
create index pro_services_cat_idx on public.professional_services(category_id) where is_active;

-- Coverage: any location level may be served (a whole state, a city or a neighbourhood).
create table public.service_locations (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  travel_available boolean not null default false,
  remote_available boolean not null default false,
  created_at timestamptz not null default now(),
  unique (professional_id, location_id)
);
create index service_locations_loc_idx on public.service_locations(location_id);

create table public.professional_availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  service_id uuid references public.professional_services(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  check (ends_on >= starts_on)
);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  category_id uuid references public.service_categories(id),
  title text not null,
  description text,
  completed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.portfolio_media (
  id uuid primary key default gen_random_uuid(),
  portfolio_item_id uuid not null references public.portfolio_items(id) on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('image','video')),
  kind text not null default 'work' check (kind in ('work','before','after')),
  sort_order int not null default 0
);

-- ---------- configurable verification ----------
-- Requirements are DATA. category_id null = baseline for every category (e.g. identity).
create table public.verification_requirements (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories(id) on delete cascade,
  applies_to_account_type public.account_type,   -- null = both
  kind public.requirement_kind not null,
  name text not null,
  description text,
  is_required boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_req_cat_idx on public.verification_requirements(category_id);

create table public.verification_applications (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null unique references public.professional_profiles(id) on delete cascade,
  status public.verification_status not null default 'not_started',
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  decision_reason text,                 -- shown to the professional
  internal_notes text,                  -- admin only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_apps_status_idx on public.verification_applications(status);

create table public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  application_id uuid references public.verification_applications(id) on delete set null,
  requirement_id uuid references public.verification_requirements(id),
  storage_path text not null,           -- private bucket, signed access only
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  review_status public.document_review_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index pro_docs_pro_idx on public.professional_documents(professional_id);

create table public.verification_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.verification_applications(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  from_status public.verification_status,
  to_status public.verification_status,
  message text,
  visible_to_professional boolean not null default true,
  created_at timestamptz not null default now()
);
create index verification_events_app_idx on public.verification_events(application_id, created_at);

-- ---------- protection triggers ----------
create or replace function public.protect_professional_columns() returns trigger
language plpgsql as $$
begin
  if not public.is_privileged() then
    if new.verification_status is distinct from old.verification_status
       or new.is_listed is distinct from old.is_listed
       or new.is_featured is distinct from old.is_featured
       or new.featured_until is distinct from old.featured_until
       or new.rating_avg is distinct from old.rating_avg
       or new.review_count is distinct from old.review_count
       or new.completed_jobs is distinct from old.completed_jobs
       or new.user_id is distinct from old.user_id then
      raise exception 'protected professional fields can only be changed by DECA';
    end if;
  end if;
  return new;
end $$;
create trigger pro_protect before update on public.professional_profiles
  for each row execute function public.protect_professional_columns();

create or replace function public.pro_insert_defaults() returns trigger language plpgsql as $$
begin
  if not public.is_privileged() then
    new.verification_status := 'not_started'; new.is_listed := false; new.is_featured := false;
    new.featured_until := null; new.rating_avg := 0; new.review_count := 0; new.completed_jobs := 0;
  end if;
  return new;
end $$;
create trigger pro_insert_defaults before insert on public.professional_profiles
  for each row execute function public.pro_insert_defaults();

create or replace function public.protect_application() returns trigger language plpgsql as $$
begin
  if not public.is_privileged() then
    if tg_op = 'INSERT' then new.status := 'not_started'; new.submitted_at := null; new.reviewed_by := null;
      new.reviewed_at := null; new.decision_reason := null; new.internal_notes := null;
    elsif new.status is distinct from old.status or new.reviewed_by is distinct from old.reviewed_by
       or new.decision_reason is distinct from old.decision_reason or new.internal_notes is distinct from old.internal_notes
       or new.professional_id is distinct from old.professional_id then
      raise exception 'verification decisions can only be made by DECA administrators';
    end if;
  end if;
  return new;
end $$;
create trigger app_protect before insert or update on public.verification_applications
  for each row execute function public.protect_application();

create or replace function public.protect_document() returns trigger language plpgsql as $$
begin
  if not public.is_privileged() then
    if tg_op = 'INSERT' then new.review_status := 'pending'; new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    elsif new.review_status is distinct from old.review_status or new.review_note is distinct from old.review_note
       or new.reviewed_by is distinct from old.reviewed_by then
      raise exception 'document review fields can only be changed by DECA administrators';
    end if;
  end if;
  return new;
end $$;
create trigger doc_protect before insert or update on public.professional_documents
  for each row execute function public.protect_document();

-- Keep the profile's public status and listing flag in step with the application decision.
create or replace function public.sync_professional_verification() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.internal_flag_on();
  update public.professional_profiles
     set verification_status = new.status,
         is_listed = (new.status = 'approved')
   where id = new.professional_id;
  return new;
end $$;
create trigger app_sync after insert or update of status on public.verification_applications
  for each row execute function public.sync_professional_verification();

create or replace function public.sync_listing_on_account_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.internal_flag_on();
  update public.professional_profiles
     set is_listed = (new.status = 'active' and verification_status = 'approved')
   where user_id = new.id;
  return new;
end $$;
create trigger profile_status_sync after update of status on public.profiles
  for each row when (old.status is distinct from new.status)
  execute function public.sync_listing_on_account_status();

-- Requirements that apply to one professional: baseline + their service categories.
create or replace function public.required_documents_for(p_professional uuid)
returns setof public.verification_requirements language sql stable security definer set search_path = public as $$
  select r.* from public.verification_requirements r
   join public.professional_profiles p on p.id = p_professional
  where r.is_active and r.is_required
    and (r.applies_to_account_type is null or r.applies_to_account_type = p.account_type)
    and (r.category_id is null
         or r.category_id = p.primary_category_id
         or r.category_id in (select category_id from public.professional_services s where s.professional_id = p.id and s.deleted_at is null))
    and (p.user_id = auth.uid() or public.is_admin() or public.is_service_role())
  order by r.sort_order $$;

create or replace function public.submit_verification_application() returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; aid uuid; st public.verification_status; missing int;
begin
  select id into pid from public.professional_profiles where user_id = auth.uid() and deleted_at is null;
  if pid is null then raise exception 'professional profile required'; end if;
  insert into public.verification_applications(professional_id) values (pid) on conflict (professional_id) do nothing;
  select id, status into aid, st from public.verification_applications where professional_id = pid;
  if st not in ('not_started','incomplete','additional_information_required') then
    raise exception 'application cannot be submitted from status %', st; end if;
  select count(*) into missing from public.required_documents_for(pid) r
   where not exists (select 1 from public.professional_documents d
                      where d.professional_id = pid and d.requirement_id = r.id and d.deleted_at is null and d.review_status <> 'rejected');
  if missing > 0 then
    raise exception '% required document(s) still missing', missing;
  end if;
  perform public.internal_flag_on();
  update public.verification_applications set status = 'submitted', submitted_at = now() where id = aid;
  insert into public.verification_events(application_id, actor_id, event_type, from_status, to_status)
    values (aid, auth.uid(), 'submitted', st, 'submitted');
  return aid;
end $$;

create or replace function public.review_verification(p_application uuid, p_decision public.verification_status, p_reason text default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_status public.verification_status;
begin
  if not public.is_admin() then raise exception 'administrator only'; end if;
  if p_decision not in ('under_review','additional_information_required','approved','rejected','suspended') then
    raise exception 'invalid decision %', p_decision; end if;
  if p_decision in ('additional_information_required','rejected') and coalesce(trim(p_reason),'') = '' then
    raise exception 'a reason is required'; end if;
  select status into old_status from public.verification_applications where id = p_application for update;
  if old_status is null then raise exception 'application not found'; end if;
  perform public.internal_flag_on();
  update public.verification_applications
     set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
         decision_reason = coalesce(p_reason, decision_reason),
         internal_notes = coalesce(p_notes, internal_notes)
   where id = p_application;
  insert into public.verification_events(application_id, actor_id, event_type, from_status, to_status, message)
    values (p_application, auth.uid(), 'admin_decision', old_status, p_decision, p_reason);
end $$;
