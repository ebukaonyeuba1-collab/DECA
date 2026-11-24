-- DECA Stage 1 | 0002 | locations, profiles, roles, helper functions

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Structured, hierarchical locations (country > state > city > neighbourhood). Data, not code.
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.locations(id) on delete restrict,
  level public.location_level not null,
  name text not null,
  slug text not null,
  code text,
  latitude numeric(9,6),   -- reserved for future maps and geolocation
  longitude numeric(9,6),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_id, slug),
  check ((level = 'country') = (parent_id is null))
);
create index locations_parent_idx on public.locations(parent_id);
create index locations_level_idx on public.locations(level) where is_active;
create index locations_name_trgm on public.locations using gin (name extensions.gin_trgm_ops);

create or replace function public.validate_location_parent() returns trigger language plpgsql as $$
declare pl public.location_level;
begin
  if new.parent_id is null then return new; end if;
  select level into pl from public.locations where id = new.parent_id;
  if (pl, new.level) not in (('country','state'),('state','city'),('city','neighbourhood')) then
    raise exception 'invalid location hierarchy: % under %', new.level, pl;
  end if;
  return new;
end $$;
create trigger locations_validate before insert or update on public.locations
  for each row execute function public.validate_location_parent();

-- One profile per auth user. Role and status are controlled by DECA, never by the user.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  status public.account_status not null default 'active',
  full_name text not null default '',
  email text,
  phone text,
  phone_verified_at timestamptz,
  avatar_path text,
  location_id uuid references public.locations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index profiles_role_idx on public.profiles(role);

create table public.customer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_location_id uuid references public.locations(id),
  marketing_consent boolean not null default false,
  privacy_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  line1 text not null,
  line2 text,
  landmark text,
  location_id uuid references public.locations(id),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index user_addresses_user_idx on public.user_addresses(user_id);

-- ---------- authorisation helpers (SECURITY DEFINER, fixed search_path) ----------
create or replace function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active' and deleted_at is null $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('admin','super_admin'), false) $$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'super_admin', false) $$;

create or replace function public.is_service_role() returns boolean
language sql stable as $$ select coalesce(auth.jwt() ->> 'role', '') = 'service_role' $$;

-- Server-side code paths (SECURITY DEFINER RPCs) raise this flag for the current transaction only.
create or replace function public.internal_flag_on() returns void
language sql as $$ select set_config('deca.internal','1', true) $$;
create or replace function public.is_privileged() returns boolean
language sql stable as $$
  select public.is_admin() or public.is_service_role() or coalesce(current_setting('deca.internal', true),'') = '1' $$;

create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$ begin return t::uuid; exception when others then return null; end $$;

-- Sign-up hook: only customer or professional can be self-selected. Admin roles are granted
-- only by a super admin or the service role, never from client-supplied metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.user_role := 'customer';
begin
  if new.raw_user_meta_data ->> 'role' = 'professional' then r := 'professional'; end if;
  insert into public.profiles (id, role, full_name, email, phone)
  values (new.id, r, coalesce(new.raw_user_meta_data ->> 'full_name',''), new.email, new.phone);
  if r = 'customer' then insert into public.customer_profiles(user_id) values (new.id); end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_profile_columns() returns trigger
language plpgsql as $$
begin
  if not public.is_privileged() then
    if new.role is distinct from old.role then raise exception 'role can only be changed by an administrator'; end if;
    if new.status is distinct from old.status then raise exception 'status can only be changed by an administrator'; end if;
    if new.id is distinct from old.id then raise exception 'id is immutable'; end if;
    if new.phone is distinct from old.phone then new.phone_verified_at := null; end if;
  end if;
  if new.role in ('admin','super_admin') and new.role is distinct from old.role and not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'only a super admin can grant administrator roles';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();
