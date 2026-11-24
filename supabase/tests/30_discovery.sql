-- Stage 2 discovery search tests. Run after 20_hardening.sql. Test rows are prefixed "ZZ" to isolate them.
do $$
declare delta uuid; warri uuid; effurun uuid; lagos uuid; ikeja uuid; cat_pl uuid; cat_cl uuid; cat_el uuid; sub_leak uuid; req uuid;
        e1 uuid := '00000000-0000-0000-0000-000000000e01'; e2 uuid := '00000000-0000-0000-0000-000000000e02'; e3 uuid := '00000000-0000-0000-0000-000000000e03';
        e4 uuid := '00000000-0000-0000-0000-000000000e04'; e5 uuid := '00000000-0000-0000-0000-000000000e05'; e6 uuid := '00000000-0000-0000-0000-000000000e06';
        p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid; a text; b text; v text; dow int := extract(dow from (now() at time zone 'Africa/Lagos'))::int;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select id into delta from public.locations where slug = 'delta' and level = 'state';
  select id into lagos from public.locations where slug = 'lagos' and level = 'state';
  insert into public.locations(parent_id, level, name, slug) values (delta,'city','ZZ Warri','zz-warri'),(lagos,'city','ZZ Ikeja','zz-ikeja');
  select id into warri from public.locations where slug = 'zz-warri'; select id into ikeja from public.locations where slug = 'zz-ikeja';
  insert into public.locations(parent_id, level, name, slug) values (warri,'neighbourhood','ZZ Effurun','zz-effurun');
  select id into effurun from public.locations where slug = 'zz-effurun';
  select id into cat_pl from public.service_categories where slug = 'plumbing'; select id into cat_cl from public.service_categories where slug = 'cleaning';
  select id into cat_el from public.service_categories where slug = 'electrical';
  select id into sub_leak from public.service_subcategories where slug = 'leak-detection'; select id into req from public.verification_requirements where kind = 'identity';

  insert into auth.users(id,email,raw_user_meta_data) select u, 'zz'||right(u::text,2)||'@t', '{"role":"professional"}' from unnest(array[e1,e2,e3,e4,e5,e6]) u;
  insert into public.professional_profiles(user_id,slug,display_name,bio,years_experience,primary_category_id,verification_status,is_listed,rating_avg,review_count,completed_jobs) values
    (e1,'zz-alpha-plumbing','ZZ Alpha Plumbing','Fixes leaks fast',10,cat_pl,'approved',true,5.0,4,10),
    (e2,'zz-beta-plumbing','ZZ Beta Plumbing','General plumbing',3,cat_pl,'approved',true,4.0,3,2),
    (e3,'zz-gamma-cleaning','ZZ Gamma Cleaning','Residential cleaning',6,cat_cl,'approved',true,4.8,10,30),
    (e4,'zz-delta-electrical','ZZ Delta Electrical','Wiring and lighting',15,cat_el,'approved',true,0,0,0),
    (e5,'zz-unlisted','ZZ Unlisted Plumbing','Should never appear',5,cat_pl,'approved',false,0,0,0),
    (e6,'zz-pending','ZZ Pending Plumbing','Not approved',5,cat_pl,'submitted',false,0,0,0);
  select id into p1 from public.professional_profiles where slug = 'zz-alpha-plumbing'; select id into p2 from public.professional_profiles where slug = 'zz-beta-plumbing';
  select id into p3 from public.professional_profiles where slug = 'zz-gamma-cleaning'; select id into p4 from public.professional_profiles where slug = 'zz-delta-electrical';
  select id into p5 from public.professional_profiles where slug = 'zz-unlisted'; select id into p6 from public.professional_profiles where slug = 'zz-pending';
  insert into public.professional_services(professional_id,category_id,subcategory_id,name,pricing_type,price_minor) values
    (p1,cat_pl,sub_leak,'Leak repair','starting',500000),(p2,cat_pl,null,'Pipe fitting','starting',900000),
    (p3,cat_cl,null,'Deep cleaning','fixed',1500000),(p4,cat_el,null,'Wiring','inspection_based',null),(p5,cat_pl,null,'Hidden plumbing','fixed',100);
  insert into public.service_locations(professional_id,location_id) values (p1,delta),(p2,effurun),(p3,ikeja),(p4,lagos),(p5,warri);
  insert into public.professional_availability(professional_id,weekday,start_time,end_time) values (p1,dow,'08:00','17:00');
  insert into public.professional_documents(professional_id,requirement_id,storage_path,file_name,review_status,uploaded_at) values (p1,req,'zz/id.jpg','id.jpg','accepted',now());

  perform t.check('search: only approved and listed professionals', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''ZZ'')') = '4');
  perform t.check('search: unlisted and pending never returned', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''ZZ'') where display_name in (''ZZ Unlisted Plumbing'',''ZZ Pending Plumbing'')') = '0');
  perform t.check('search: category filter', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''ZZ'', p_category => ''plumbing'')') = '2');
  perform t.check('search: subcategory filter', t.val(null,'anon','select string_agg(display_name, '','') from public.search_professionals(p_query => ''ZZ'', p_subcategory => ''leak-detection'')') = 'ZZ Alpha Plumbing');
  perform t.check('search: matches professional name', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''Alpha'') where display_name = ''ZZ Alpha Plumbing''') = '1');
  perform t.check('search: matches service name', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''Pipe fitting'') where display_name = ''ZZ Beta Plumbing''') = '1');
  perform t.check('search: matches category name', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''cleaning'') where display_name = ''ZZ Gamma Cleaning''') = '1');
  perform t.check('search: LIKE wildcards are escaped', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''%'')') = '0' and t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''_'')') = '0');
  perform t.check('search: hostile text is harmless', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''''''; drop table public.profiles; --'')') = '0' and (select count(*) from information_schema.tables where table_name = 'profiles') = 1);
  perform t.check('location: state coverage matches a city search; neighbourhood coverage matches too; other regions excluded',
     t.val(null,'anon', format('select string_agg(display_name, '','' order by display_name) from public.search_professionals(p_query => ''ZZ'', p_location => %L)', warri)) = 'ZZ Alpha Plumbing,ZZ Beta Plumbing');
  perform t.check('location: state search includes cities and state-wide coverage', t.val(null,'anon', format('select string_agg(display_name, '','' order by display_name) from public.search_professionals(p_query => ''ZZ'', p_location => %L)', lagos)) = 'ZZ Delta Electrical,ZZ Gamma Cleaning');
  perform t.check('location: city search includes state-wide coverage above it', t.val(null,'anon', format('select string_agg(display_name, '','' order by display_name) from public.search_professionals(p_query => ''ZZ'', p_location => %L)', ikeja)) = 'ZZ Delta Electrical,ZZ Gamma Cleaning');
  perform t.check('filter: minimum rating excludes unreviewed', t.val(null,'anon','select string_agg(display_name, '','' order by display_name) from public.search_professionals(p_query => ''ZZ'', p_min_rating => 4.5)') = 'ZZ Alpha Plumbing,ZZ Gamma Cleaning');
  perform t.check('filter: minimum experience', t.val(null,'anon','select string_agg(display_name, '','' order by display_name) from public.search_professionals(p_query => ''ZZ'', p_min_years => 10)') = 'ZZ Alpha Plumbing,ZZ Delta Electrical');
  perform t.check('filter: maximum price excludes unpriced and dearer', t.val(null,'anon','select string_agg(display_name, '','') from public.search_professionals(p_query => ''ZZ'', p_max_price_minor => 600000)') = 'ZZ Alpha Plumbing');
  perform t.check('filter: identity verified comes from accepted documents', t.val(null,'anon','select string_agg(display_name, '','') from public.search_professionals(p_query => ''ZZ'', p_verification => ''identity'')') = 'ZZ Alpha Plumbing'
     and t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''ZZ'', p_verification => ''credentials'')') = '0');
  perform t.check('filter: available today', t.val(null,'anon','select string_agg(display_name, '','') from public.search_professionals(p_query => ''ZZ'', p_available_today => true)') = 'ZZ Alpha Plumbing');
  insert into public.availability_exceptions(professional_id, starts_on, ends_on) values (p1, (now() at time zone 'Africa/Lagos')::date, (now() at time zone 'Africa/Lagos')::date);
  perform t.check('filter: a day off removes availability', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''ZZ'', p_available_today => true)') = '0');
  perform t.check('sort: highest rated first', t.val(null,'anon','select display_name from public.search_professionals(p_query => ''ZZ'', p_sort => ''rating'') limit 1') = 'ZZ Alpha Plumbing');
  perform t.check('sort: most experienced first', t.val(null,'anon','select display_name from public.search_professionals(p_query => ''ZZ'', p_sort => ''experience'') limit 1') = 'ZZ Delta Electrical');
  perform t.check('sort: most reviewed first', t.val(null,'anon','select display_name from public.search_professionals(p_query => ''ZZ'', p_sort => ''reviews'') limit 1') = 'ZZ Gamma Cleaning');
  a := t.val(null,'anon','select string_agg(display_name, '','' order by ordinality) from (select display_name, row_number() over () as ordinality from public.search_professionals(p_query => ''ZZ'')) x');
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);   -- helpers replace the claim; restore it
  update public.professional_profiles set is_featured = true where id = p3;
  b := t.val(null,'anon','select string_agg(display_name, '','' order by ordinality) from (select display_name, row_number() over () as ordinality from public.search_professionals(p_query => ''ZZ'')) x');
  perform t.check('recommended order is not changed by sponsorship', a = b);
  perform t.check('sponsored professionals are flagged', t.val(null,'anon','select is_sponsored::text from public.search_professionals(p_query => ''ZZ Gamma'')') = 'true');
  perform t.check('pagination: total_count is stable and pages are disjoint',
     t.val(null,'anon','select count(distinct total_count)::text from public.search_professionals(p_query => ''ZZ'', p_limit => 2)') = '1'
     and t.val(null,'anon','select max(total_count)::text from public.search_professionals(p_query => ''ZZ'', p_limit => 2, p_offset => 2)') = '4'
     and (select count(*) from (select id from public.search_professionals(p_query => 'ZZ', p_limit => 2, p_offset => 0) intersect select id from public.search_professionals(p_query => 'ZZ', p_limit => 2, p_offset => 2)) x) = 0);
  perform t.check('pagination: limits are clamped', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''ZZ'', p_limit => 0)') = '1'
     and t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''ZZ'', p_limit => 100000, p_offset => -5)') = '4');
  perform t.check('invalid sort or verification values fall back safely', t.val(null,'anon','select count(*)::text from public.search_professionals(p_query => ''ZZ'', p_sort => ''x; drop'', p_verification => ''nope'')') = '4');
  perform t.check('search output exposes no private columns', pg_get_function_result('public.search_professionals(text,text,text,uuid,numeric,text,int,bigint,boolean,text,int,int)'::regprocedure) !~* '(email|phone|user_id|registration|internal|account)');
  perform t.check('category counts match public professionals only', (select professional_count from public.public_category_counts() where category_slug = 'cleaning')
        = (select count(*) from public.public_professionals pp where pp.primary_category_slug = 'cleaning' or exists (select 1 from public.public_professional_services s where s.professional_id = pp.id and s.category_slug = 'cleaning')));
  perform t.check('anon may call search but still cannot read base tables', t.fails(t.try(null,'anon','select 1 from public.professional_profiles limit 1')));
  perform t.check('public service view exposes subcategory slug', t.val(null,'anon','select subcategory_slug from public.public_professional_services where name = ''Leak repair''') = 'leak-detection');
end $$;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
select label as failed_check from t.results where not ok;
do $$ begin if exists (select 1 from t.results where not ok) then raise exception 'database tests failed'; end if; end $$;
