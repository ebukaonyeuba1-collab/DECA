-- DECA Stage 2 | 0013 | discovery search, category counts
-- Both functions read only the public views and return an explicit, non-private column list.

-- Add subcategory slug for filtering (appended: CREATE OR REPLACE VIEW may only add columns at the end).
create or replace view public.public_professional_services with (security_barrier = true) as
select s.id, s.professional_id, c.slug as category_slug, c.name as category_name, sc.name as subcategory_name,
       s.name, s.description, s.inclusions, s.exclusions, s.pricing_type, s.price_minor, s.minimum_charge_minor,
       s.additional_charges, s.duration_minutes, s.currency, sc.slug as subcategory_slug
  from public.professional_services s
  join public.service_categories c on c.id = s.category_id
  left join public.service_subcategories sc on sc.id = s.subcategory_id
 where s.is_active and s.deleted_at is null and public.is_pro_public(s.professional_id);

create or replace function public.search_professionals(
  p_query text default null, p_category text default null, p_subcategory text default null, p_location uuid default null,
  p_min_rating numeric default null, p_verification text default 'any', p_min_years int default null,
  p_max_price_minor bigint default null, p_available_today boolean default false,
  p_sort text default 'recommended', p_limit int default 12, p_offset int default 0)
returns table (
  id uuid, slug text, display_name text, headline text, summary text, years_experience int,
  primary_category_slug text, primary_category_name text, avatar_path text, business_name text,
  rating_avg numeric, review_count int, completed_jobs int, is_sponsored boolean,
  identity_verified boolean, credentials_verified boolean, experience_verified boolean,
  starting_price_minor bigint, pricing_type public.pricing_type, currency char(3), location_label text, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 12), 1), 48);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_sort text := case when p_sort in ('recommended','rating','experience','newest','reviews') then p_sort else 'recommended' end;
  v_ver text := case when p_verification in ('identity','credentials','experience') then p_verification else 'any' end;
  v_q text := nullif(trim(coalesce(p_query, '')), '');
  v_like text;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_dow int := extract(dow from (now() at time zone 'Africa/Lagos'))::int;
begin
  if v_q is not null then
    v_q := left(v_q, 80);
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  return query
  with recursive up as (select l.id, l.parent_id from public.locations l where l.id = p_location
                        union all select l.id, l.parent_id from public.locations l join up on l.id = up.parent_id),
       down as (select l.id from public.locations l where l.id = p_location
                union all select l.id from public.locations l join down d on l.parent_id = d.id),
       loc_match as (select up.id from up union select down.id from down),
  base as (
    select pp.*, price.price_minor as sp, price.pricing_type as sp_type, price.currency as sp_cur, lbl.label,
           ( (pp.identity_verified::int * 3) + (pp.credentials_verified::int * 2) + (pp.experience_verified::int * 2)
             + least(pp.completed_jobs, 50) * 0.1
             + case when pp.review_count > 0 then (pp.rating_avg - 3) * least(pp.review_count, 20) / 20.0 * 2 else 0 end )::numeric as score
      from public.public_professionals pp
      left join lateral (select s.price_minor, s.pricing_type, s.currency from public.public_professional_services s
                          where s.professional_id = pp.id and s.price_minor is not null order by s.price_minor limit 1) price on true
      left join lateral (select coalesce(c.city_name || ', ' || c.state_name, c.state_name, c.location_name) as label
                           from public.public_service_coverage c where c.professional_id = pp.id
                          order by case c.level when 'city' then 1 when 'neighbourhood' then 2 when 'state' then 3 else 4 end limit 1) lbl on true
     where (p_category is null or pp.primary_category_slug = p_category
            or exists (select 1 from public.public_professional_services s where s.professional_id = pp.id and s.category_slug = p_category))
       and (p_subcategory is null or exists (select 1 from public.public_professional_services s where s.professional_id = pp.id and s.subcategory_slug = p_subcategory))
       and (v_q is null or pp.search_document @@ websearch_to_tsquery('simple', v_q)
            or pp.display_name ilike v_like or coalesce(pp.business_name, '') ilike v_like or coalesce(pp.primary_category_name, '') ilike v_like
            or exists (select 1 from public.public_professional_services s where s.professional_id = pp.id and (s.name ilike v_like or s.category_name ilike v_like)))
       and (p_location is null or exists (select 1 from public.public_service_coverage c where c.professional_id = pp.id and c.location_id in (select loc_match.id from loc_match)))
       and (p_min_rating is null or (pp.review_count > 0 and pp.rating_avg >= p_min_rating))
       and (v_ver = 'any' or (v_ver = 'identity' and pp.identity_verified) or (v_ver = 'credentials' and pp.credentials_verified) or (v_ver = 'experience' and pp.experience_verified))
       and (p_min_years is null or coalesce(pp.years_experience, 0) >= p_min_years)
       and (p_max_price_minor is null or (price.price_minor is not null and price.price_minor <= p_max_price_minor))
       and (not coalesce(p_available_today, false) or (
              exists (select 1 from public.public_availability a where a.professional_id = pp.id and a.weekday = v_dow)
              and not exists (select 1 from public.availability_exceptions e where e.professional_id = pp.id and v_today between e.starts_on and e.ends_on)))
  )
  select b.id, b.slug, b.display_name, b.headline, left(b.bio, 180), b.years_experience,
         b.primary_category_slug, b.primary_category_name, b.avatar_path, b.business_name,
         b.rating_avg, b.review_count, b.completed_jobs, b.is_sponsored,
         b.identity_verified, b.credentials_verified, b.experience_verified,
         b.sp, b.sp_type, b.sp_cur, b.label, count(*) over () as total_count
    from base b
   order by
     case v_sort when 'recommended' then b.score
                 when 'rating' then (case when b.review_count > 0 then b.rating_avg else -1 end)
                 when 'experience' then coalesce(b.years_experience, -1)::numeric
                 when 'reviews' then b.review_count::numeric else 0 end desc,
     case v_sort when 'newest' then extract(epoch from b.joined_at) else 0 end desc,
     b.review_count desc, b.display_name, b.id
   limit v_limit offset v_offset;
end $$;

-- Professionals per category (primary category or any active service), public professionals only.
create or replace function public.public_category_counts() returns table (category_slug text, professional_count bigint)
language sql stable security definer set search_path = public as $$
  select c.slug, count(distinct pp.id)
    from public.service_categories c
    join public.public_professionals pp on pp.primary_category_slug = c.slug
      or exists (select 1 from public.public_professional_services s where s.professional_id = pp.id and s.category_slug = c.slug)
   where c.is_active group by c.slug $$;

revoke all on function public.search_professionals(text,text,text,uuid,numeric,text,int,bigint,boolean,text,int,int) from public;
revoke all on function public.public_category_counts() from public;
grant execute on function public.search_professionals(text,text,text,uuid,numeric,text,int,bigint,boolean,text,int,int) to anon, authenticated, service_role;
grant execute on function public.public_category_counts() to anon, authenticated, service_role;
grant select on public.public_professional_services to anon, authenticated;
