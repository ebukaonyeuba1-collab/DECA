-- DECA Stage 1 refinement | 0010 | public discovery through explicit views only
-- Public and authenticated visitors never read base tables for discovery. Views list columns explicitly,
-- so a column added to a table later is NOT exposed until someone adds it here deliberately.

-- 1. Remove base-table public access
drop policy pro_public on public.professional_profiles;
drop policy business_public on public.businesses;
do $$ declare t text; begin
  foreach t in array array['professional_services','service_locations','professional_availability','availability_exceptions','portfolio_items']
  loop execute format('drop policy %1$s_public on public.%1$I', t); end loop;
end $$;
drop policy portfolio_media_public on public.portfolio_media;
drop policy reviews_public on public.reviews;
drop policy rresp_public on public.review_responses;
create policy reviews_parties on public.reviews for select using (customer_id = auth.uid() or public.owns_professional(professional_id) or public.is_admin());
create policy rresp_parties on public.review_responses for select using (
  public.owns_professional(professional_id) or public.is_admin()
  or exists (select 1 from public.reviews r where r.id = review_id and r.customer_id = auth.uid()));
-- A conversation partner must not receive the other person's email or phone through profiles.
drop policy profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using (id = auth.uid() or public.is_admin());

-- 2. Public views (owner-privileged, security_barrier, filtered to approved + listed + active)
create view public.public_professionals with (security_barrier = true) as
select p.id, p.slug, p.display_name, p.headline, p.bio, p.years_experience, p.account_type,
       c.id as primary_category_id, c.slug as primary_category_slug, c.name as primary_category_name,
       u.avatar_path, b.registered_name as business_name, b.logo_path as business_logo_path,
       p.rating_avg, p.review_count, p.completed_jobs,
       (p.is_featured and (p.featured_until is null or p.featured_until > now())) as is_sponsored,
       exists (select 1 from public.professional_documents d join public.verification_requirements r on r.id = d.requirement_id
                where d.professional_id = p.id and d.review_status = 'accepted' and d.deleted_at is null and r.kind = 'identity') as identity_verified,
       exists (select 1 from public.professional_documents d join public.verification_requirements r on r.id = d.requirement_id
                where d.professional_id = p.id and d.review_status = 'accepted' and d.deleted_at is null and r.kind in ('qualification','licence','certification')) as credentials_verified,
       exists (select 1 from public.professional_documents d join public.verification_requirements r on r.id = d.requirement_id
                where d.professional_id = p.id and d.review_status = 'accepted' and d.deleted_at is null and r.kind = 'experience_evidence') as experience_verified,
       p.created_at as joined_at, p.search_document
  from public.professional_profiles p
  join public.profiles u on u.id = p.user_id
  left join public.service_categories c on c.id = p.primary_category_id
  left join public.businesses b on b.id = p.business_id and b.deleted_at is null
 where p.verification_status = 'approved' and p.is_listed and p.deleted_at is null and u.status = 'active' and u.deleted_at is null;

create view public.public_professional_services with (security_barrier = true) as
select s.id, s.professional_id, c.slug as category_slug, c.name as category_name, sc.name as subcategory_name,
       s.name, s.description, s.inclusions, s.exclusions, s.pricing_type, s.price_minor, s.minimum_charge_minor,
       s.additional_charges, s.duration_minutes, s.currency
  from public.professional_services s
  join public.service_categories c on c.id = s.category_id
  left join public.service_subcategories sc on sc.id = s.subcategory_id
 where s.is_active and s.deleted_at is null and public.is_pro_public(s.professional_id);

create view public.public_service_coverage with (security_barrier = true) as
select sl.professional_id, l.id as location_id, l.level, l.name as location_name,
       case l.level when 'state' then l.name when 'city' then l1.name when 'neighbourhood' then l2.name end as state_name,
       case l.level when 'city' then l.name when 'neighbourhood' then l1.name end as city_name,
       case l.level when 'neighbourhood' then l.name end as neighbourhood_name,
       sl.travel_available, sl.remote_available
  from public.service_locations sl
  join public.locations l on l.id = sl.location_id and l.is_active
  left join public.locations l1 on l1.id = l.parent_id
  left join public.locations l2 on l2.id = l1.parent_id
 where public.is_pro_public(sl.professional_id);

create view public.public_portfolio with (security_barrier = true) as
select i.id, i.professional_id, i.title, i.description, i.completed_on, c.slug as category_slug,
       coalesce((select jsonb_agg(jsonb_build_object('path', m.storage_path, 'type', m.media_type, 'kind', m.kind) order by m.sort_order)
                   from public.portfolio_media m where m.portfolio_item_id = i.id), '[]'::jsonb) as media
  from public.portfolio_items i left join public.service_categories c on c.id = i.category_id
 where i.deleted_at is null and public.is_pro_public(i.professional_id);

create view public.public_reviews with (security_barrier = true) as
select r.id, r.professional_id, r.rating_overall, r.rating_quality, r.rating_communication, r.rating_punctuality, r.rating_value,
       r.body, r.created_at,
       coalesce(nullif(split_part(trim(u.full_name), ' ', 1) ||
         case when position(' ' in trim(u.full_name)) > 0 then ' ' || left(regexp_replace(trim(u.full_name), '^.*\s', ''), 1) || '.' else '' end, ''), 'Customer') as reviewer_name,
       rr.body as response_body, rr.created_at as response_at
  from public.reviews r
  join public.profiles u on u.id = r.customer_id
  left join public.review_responses rr on rr.review_id = r.id
 where r.status = 'published' and public.is_pro_public(r.professional_id);

create view public.public_availability with (security_barrier = true) as
select a.professional_id, a.service_id, a.weekday, a.start_time, a.end_time
  from public.professional_availability a where public.is_pro_public(a.professional_id);

-- Authenticated only: names of the people you share a conversation with (never email or phone).
create view public.conversation_parties with (security_barrier = true) as
select u.id, u.role,
       coalesce(pp.display_name, nullif(split_part(trim(u.full_name), ' ', 1) ||
         case when position(' ' in trim(u.full_name)) > 0 then ' ' || left(regexp_replace(trim(u.full_name), '^.*\s', ''), 1) || '.' else '' end, ''), 'DECA user') as display_name,
       u.avatar_path
  from public.profiles u left join public.professional_profiles pp on pp.user_id = u.id
 where u.id = auth.uid() or public.shares_conversation_with(u.id);

-- 3. Privileges
revoke select on public.professional_profiles, public.professional_services, public.service_locations, public.professional_availability,
  public.availability_exceptions, public.portfolio_items, public.portfolio_media, public.reviews, public.review_responses, public.businesses from anon;
revoke all on public.public_professionals, public.public_professional_services, public.public_service_coverage, public.public_portfolio,
  public.public_reviews, public.public_availability, public.conversation_parties from public, anon, authenticated;
grant select on public.public_professionals, public.public_professional_services, public.public_service_coverage, public.public_portfolio,
  public.public_reviews, public.public_availability to anon, authenticated;
grant select on public.conversation_parties to authenticated;
