-- DEVELOPMENT DEMO DATA ONLY. Never run in production.
-- Clearly labelled "[DEMO]" professionals so Stage 2 screens have something to show. They have NO reviews,
-- NO ratings, NO verified badges (badges derive from admin-accepted documents) and NO completed jobs.
-- Run with:  psql ... -c "set deca.allow_demo_seed = 'on'" -f supabase/seed.demo.sql   (same session)
do $$ begin
  if coalesce(current_setting('deca.allow_demo_seed', true), '') <> 'on' then
    raise exception 'demo seed refused: run "set deca.allow_demo_seed = ''on''" in the same session first';
  end if;
end $$;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);

-- Demo locations (cities and neighbourhoods are normally added by admins).
with s as (select id, slug from public.locations where level = 'state' and slug in ('delta','lagos','federal-capital-territory'))
insert into public.locations(parent_id, level, name, slug)
select s.id, 'city', v.name, v.slug from s join (values ('delta','Warri','warri'),('lagos','Ikeja','ikeja'),('lagos','Lekki','lekki'),('federal-capital-territory','Wuse','wuse')) v(st,name,slug) on v.st = s.slug
on conflict do nothing;
insert into public.locations(parent_id, level, name, slug)
select c.id, 'neighbourhood', 'Effurun', 'effurun' from public.locations c where c.slug = 'warri' and c.level = 'city' on conflict do nothing;

create temp table demo(n int, uid uuid, slug text, name text, cat text, sub text, years int, price bigint, ptype public.pricing_type, svc text, loc text, bio text);
insert into demo values
 (1,'00000000-0000-0000-0000-00000000d001','demo-ade-plumbing','[DEMO] Ade Plumbing Services','plumbing','leak-detection',9,800000,'starting','Leak detection and repair','warri','Demo profile. Pipe repairs, leak detection and bathroom plumbing.'),
 (2,'00000000-0000-0000-0000-00000000d002','demo-spark-electrical','[DEMO] Spark Electrical Works','electrical','wiring',12,700000,'starting','House wiring','effurun','Demo profile. Wiring, lighting installation and troubleshooting.'),
 (3,'00000000-0000-0000-0000-00000000d003','demo-fresh-nest-cleaning','[DEMO] Fresh Nest Cleaning','cleaning','deep-cleaning',5,1500000,'fixed','Deep cleaning (2 bedroom)','ikeja','Demo profile. Residential and move-out cleaning.'),
 (4,'00000000-0000-0000-0000-00000000d004','demo-cool-air-hvac','[DEMO] Cool Air AC Services','air-conditioning-refrigeration','ac-servicing',7,1200000,'fixed','Split unit servicing','lekki','Demo profile. AC installation, servicing and repairs.'),
 (5,'00000000-0000-0000-0000-00000000d005','demo-prime-plumbers','[DEMO] Prime Plumbers','plumbing','pipe-repairs',3,600000,'starting','Pipe repairs','wuse','Demo profile. General plumbing maintenance.'),
 (6,'00000000-0000-0000-0000-00000000d006','demo-bright-wire','[DEMO] BrightWire Electricals','electrical','lighting-installation',15,null,'inspection_based','Lighting installation','warri','Demo profile. Quotation after inspection.');
insert into auth.users(id, email, raw_user_meta_data) select uid, slug || '@demo.invalid', jsonb_build_object('role','professional','full_name', name) from demo on conflict do nothing;
insert into public.professional_profiles(user_id, slug, display_name, headline, bio, years_experience, primary_category_id, verification_status, is_listed)
select d.uid, d.slug, d.name, d.svc, d.bio, d.years, c.id, 'approved', true from demo d join public.service_categories c on c.slug = d.cat on conflict do nothing;
insert into public.professional_services(professional_id, category_id, subcategory_id, name, description, pricing_type, price_minor)
select p.id, c.id, sc.id, d.svc, d.bio, d.ptype, d.price from demo d join public.professional_profiles p on p.slug = d.slug
  join public.service_categories c on c.slug = d.cat left join public.service_subcategories sc on sc.category_id = c.id and sc.slug = d.sub
 where not exists (select 1 from public.professional_services x where x.professional_id = p.id);
insert into public.service_locations(professional_id, location_id, travel_available)
select p.id, l.id, true from demo d join public.professional_profiles p on p.slug = d.slug join public.locations l on l.slug = d.loc on conflict do nothing;
insert into public.professional_availability(professional_id, weekday, start_time, end_time)
select p.id, w, '08:00', '17:00' from demo d join public.professional_profiles p on p.slug = d.slug, generate_series(1,5) w
 where not exists (select 1 from public.professional_availability a where a.professional_id = p.id);
