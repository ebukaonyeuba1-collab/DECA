-- Admin professional management: pending, approved and rejected views, search, history, retention, authorisation.
do $$
declare ad uuid := '00000000-0000-0000-0000-0000000000ad'; c1 uuid := '00000000-0000-0000-0000-0000000000c1'; p1 uuid := '00000000-0000-0000-0000-0000000000a1';
        a1 uuid := '00000000-0000-0000-0000-000000000a01'; a2 uuid := '00000000-0000-0000-0000-000000000a02'; a3 uuid := '00000000-0000-0000-0000-000000000a03';
        a4 uuid := '00000000-0000-0000-0000-000000000a04'; a5 uuid := '00000000-0000-0000-0000-000000000a05'; a6 uuid := '00000000-0000-0000-0000-000000000a06'; a7 uuid := '00000000-0000-0000-0000-000000000a07';
        pl uuid; el uuid; warri uuid; ikeja uuid; lagos uuid; delta uuid; req uuid;
        q1 uuid; q2 uuid; q3 uuid; q4 uuid; q5 uuid; q6 uuid; q7 uuid; app1 uuid; app2 uuid; app4 uuid;
        before_pros bigint; before_docs bigint; before_apps bigint; before_events bigint; r text; v text; ev record;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select id into pl from public.service_categories where slug = 'plumbing'; select id into el from public.service_categories where slug = 'electrical';
  select id into warri from public.locations where slug = 'zz-warri'; select id into ikeja from public.locations where slug = 'zz-ikeja';
  select id into lagos from public.locations where slug = 'lagos' and level = 'state'; select id into delta from public.locations where slug = 'delta' and level = 'state';
  select id into req from public.verification_requirements where kind = 'identity';

  insert into auth.users(id,email,raw_user_meta_data) select u, 'av'||right(u::text,2)||'@mail.test', jsonb_build_object('role','professional','full_name','AV owner') from unnest(array[a1,a2,a3,a4,a5,a6,a7]) u;
  update public.profiles set location_id = warri where id in (a1,a2,a5,a6,a7); update public.profiles set location_id = ikeja where id in (a3,a4);
  insert into public.professional_profiles(user_id,slug,display_name,primary_category_id,account_type) values
    (a1,'av-pending-one','AV Pending One',pl,'individual'),(a2,'av-review-two','AV Review Two',el,'individual'),(a3,'av-approved-three','AV Approved Three',pl,'business'),
    (a4,'av-rejected-four','AV Rejected Four',el,'individual'),(a5,'av-moreinfo-five','AV MoreInfo Five',pl,'individual'),(a6,'av-notstarted-six','AV NotStarted Six',el,'individual'),(a7,'av-suspended-seven','AV Suspended Seven',pl,'individual');
  select id into q1 from public.professional_profiles where user_id = a1; select id into q2 from public.professional_profiles where user_id = a2; select id into q3 from public.professional_profiles where user_id = a3;
  select id into q4 from public.professional_profiles where user_id = a4; select id into q5 from public.professional_profiles where user_id = a5; select id into q6 from public.professional_profiles where user_id = a6; select id into q7 from public.professional_profiles where user_id = a7;
  insert into public.businesses(owner_user_id, registered_name) values (a3, 'Zenith Pipes Ltd');
  update public.professional_profiles set business_id = (select id from public.businesses where owner_user_id = a3) where id = q3;
  insert into public.service_locations(professional_id, location_id) values (q6, delta);
  -- applications in each state (statuses sync to the professional automatically)
  insert into public.verification_applications(professional_id,status,submitted_at,reviewed_by,reviewed_at,decision_reason) values
    (q1,'submitted', now() - interval '3 days', null, null, null), (q2,'under_review', now() - interval '2 days', ad, now() - interval '1 day', null),
    (q3,'approved', now() - interval '9 days', ad, now() - interval '8 days', null), (q4,'rejected', now() - interval '7 days', ad, now() - interval '6 days', 'Documents unreadable'),
    (q5,'additional_information_required', now() - interval '1 day', ad, now(), 'Please add a clearer ID photo'), (q7,'suspended', now() - interval '20 days', ad, now() - interval '2 days', 'Complaint under review');

  -- authorisation
  perform t.check('admin list: customers are refused', t.fails(t.try(c1,'authenticated','select * from public.admin_list_professionals()')));
  perform t.check('admin list: professionals are refused', t.fails(t.try(p1,'authenticated','select * from public.admin_list_professionals()')));
  perform t.check('admin list: anonymous visitors are refused', t.fails(t.try(null,'anon','select * from public.admin_list_professionals()')));
  perform t.check('admin counts: non-admins are refused', t.fails(t.try(c1,'authenticated','select * from public.admin_verification_counts()')) and t.fails(t.try(null,'anon','select * from public.admin_verification_counts()')));

  -- views
  perform t.check('pending view: shows submitted, under review and more-information cases, oldest first',
     t.val(ad,'authenticated','select string_agg(display_name, '','' order by ordinality) from (select display_name, row_number() over () ordinality from public.admin_list_professionals(p_group => ''pending'', p_query => ''AV '')) x') = 'AV Pending One,AV Review Two,AV MoreInfo Five');
  perform t.check('pending view: excludes approved, rejected, suspended and not started',
     t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''pending'', p_query => ''AV '') where status in (''approved'',''rejected'',''suspended'',''not_started'')') = '0');
  perform t.check('approved view: approved professionals remain accessible', t.val(ad,'authenticated','select string_agg(display_name, '','') from public.admin_list_professionals(p_group => ''approved'', p_query => ''AV '')') = 'AV Approved Three');
  perform t.check('approved view: still listed publicly and keeps its application', t.val(ad,'authenticated','select is_listed::text || (application_id is not null)::text from public.admin_list_professionals(p_group => ''approved'', p_query => ''AV '')') = 'truetrue');
  perform t.check('rejected view: rejected applications remain accessible with their reason',
     t.val(ad,'authenticated','select display_name || ''|'' || decision_reason from public.admin_list_professionals(p_group => ''rejected'', p_query => ''AV '')') = 'AV Rejected Four|Documents unreadable');
  perform t.check('rejected view: shows who decided', t.val(ad,'authenticated','select reviewed_by_name from public.admin_list_professionals(p_group => ''rejected'', p_query => ''AV '')') is not null);
  perform t.check('suspended and not-started views', t.val(ad,'authenticated','select display_name from public.admin_list_professionals(p_group => ''suspended'', p_query => ''AV '')') = 'AV Suspended Seven'
     and t.val(ad,'authenticated','select display_name || (application_id is null)::text from public.admin_list_professionals(p_group => ''not_started'', p_query => ''AV '')') = 'AV NotStarted Sixtrue');
  perform t.check('all view: every professional is reachable', t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''all'', p_query => ''AV '')') = '7');
  perform t.check('unknown group falls back to pending', t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''x; drop'', p_query => ''AV '')') = '3');

  -- search and filters
  perform t.check('filter: exact verification status', t.val(ad,'authenticated','select string_agg(display_name, '','') from public.admin_list_professionals(p_group => ''all'', p_status => ''additional_information_required'', p_query => ''AV '')') = 'AV MoreInfo Five');
  perform t.check('search: by professional name', t.val(ad,'authenticated','select string_agg(display_name, '','') from public.admin_list_professionals(p_group => ''all'', p_query => ''rejected four'')') = 'AV Rejected Four');
  perform t.check('search: by business name', t.val(ad,'authenticated','select string_agg(display_name, '','') from public.admin_list_professionals(p_group => ''all'', p_query => ''zenith pipes'')') = 'AV Approved Three');
  perform t.check('search: by email (administrators only)', t.val(ad,'authenticated','select string_agg(display_name, '','') from public.admin_list_professionals(p_group => ''all'', p_query => ''av01@mail.test'')') = 'AV Pending One');
  perform t.check('search: wildcards and hostile text are harmless', t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''all'', p_query => ''%'')') = '0'
     and t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''all'', p_query => ''''''; drop table public.profiles; --'')') = '0');
  perform t.check('filter: category', t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''all'', p_query => ''AV '', p_category => ''electrical'')') = '3');
  perform t.check('filter: location matches base location, coverage and the state above it',
     t.val(ad,'authenticated', format('select string_agg(display_name, '','' order by display_name) from public.admin_list_professionals(p_group => ''all'', p_query => ''AV '', p_location => %L)', ikeja)) = 'AV Approved Three,AV Rejected Four'
     and t.val(ad,'authenticated', format('select count(*)::text from public.admin_list_professionals(p_group => ''all'', p_query => ''AV '', p_location => %L)', lagos)) = '2'
     and t.val(ad,'authenticated', format('select count(*)::text from public.admin_list_professionals(p_group => ''all'', p_query => ''AV '', p_location => %L)', delta)) = '5');
  perform t.check('filters combine', t.val(ad,'authenticated', format('select string_agg(display_name, '','') from public.admin_list_professionals(p_group => ''pending'', p_category => ''plumbing'', p_query => ''AV '', p_location => %L)', warri)) like 'AV Pending One%');
  perform t.check('paging: limit is clamped and total is stable', t.val(ad,'authenticated','select count(distinct total_count)::text from public.admin_list_professionals(p_group => ''all'', p_query => ''AV '', p_limit => 2)') = '1'
     and t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''all'', p_query => ''AV '', p_limit => 0)') = '1');
  perform t.check('counts match the views', t.val(ad,'authenticated','select n::text from public.admin_verification_counts() where grp = ''approved''')::int >= 1
     and (select count(*) from public.professional_profiles where verification_status = 'rejected') = t.val(ad,'authenticated','select n::text from public.admin_verification_counts() where grp = ''rejected''')::int);

  -- decisions: pending moves to rejected / approved, nothing is deleted, history records who/what/why/when
  select id into app1 from public.verification_applications where professional_id = q1; select id into app2 from public.verification_applications where professional_id = q2; select id into app4 from public.verification_applications where professional_id = q4;
  select count(*) into before_pros from public.professional_profiles; select count(*) into before_docs from public.professional_documents; select count(*) into before_apps from public.verification_applications; select count(*) into before_events from public.verification_events;
  insert into public.professional_documents(professional_id,requirement_id,storage_path,file_name,review_status,uploaded_at,application_id) values (q2,req,'av/'||q2||'/id.jpg','id.jpg','pending',now(),app2);
  insert into public.professional_documents(professional_id,requirement_id,storage_path,file_name,review_status,uploaded_at,deleted_at) values (q2,null,'av/'||q2||'/old.pdf','old.pdf','pending',now(),now());
  r := t.try(ad,'authenticated', format('select public.review_verification(%L,''rejected'',''Photo does not match the name'')', app1));
  perform t.check('reject: records the decision', r = 'ok');
  perform t.check('reject: leaves the pending view and appears under rejected with the reason', t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''pending'', p_query => ''Pending One'')') = '0'
     and t.val(ad,'authenticated','select decision_reason from public.admin_list_professionals(p_group => ''rejected'', p_query => ''Pending One'')') = 'Photo does not match the name');
  perform t.check('reject: the professional is not listed publicly', t.val(null,'anon','select count(*)::text from public.public_professionals where slug = ''av-pending-one''') = '0');
  select doc.id into v from public.professional_documents doc where doc.professional_id = q2 and doc.file_name = 'id.jpg';
  perform t.check('approve: refused until the required document is accepted', t.fails(t.try(ad,'authenticated', format('select public.review_verification(%L,''approved'')', app2))));
  perform t.check('approve: document accepted by an administrator', t.try(ad,'authenticated', format('select public.review_document(%L,''accepted'')', v)) = 'ok');
  perform t.check('approve: records the decision', t.try(ad,'authenticated', format('select public.review_verification(%L,''approved'')', app2)) = 'ok');
  perform t.check('approve: leaves pending and appears under approved, still reachable', t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''pending'', p_query => ''Review Two'')') = '0'
     and t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''approved'', p_query => ''Review Two'')') = '1');
  perform t.check('approve: becomes publicly discoverable', t.val(null,'anon','select count(*)::text from public.public_professionals where slug = ''av-review-two''') = '1');
  perform t.check('retention: no professional, document or application was deleted by decisions', (select count(*) from public.professional_profiles) = before_pros
     and (select count(*) from public.professional_documents) >= before_docs and (select count(*) from public.verification_applications) = before_apps);
  perform t.check('retention: decisions only added history rows', (select count(*) from public.verification_events) > before_events);
  select e.actor_id, e.event_type, e.from_status, e.to_status, e.message, e.created_at into ev from public.verification_events e where e.application_id = app1 and e.event_type = 'admin_decision' order by e.created_at desc limit 1;
  perform t.check('history: records administrator id, decision, reason and timestamp', ev.actor_id = ad and ev.to_status = 'rejected' and ev.from_status = 'submitted' and ev.message = 'Photo does not match the name' and ev.created_at is not null);
  perform t.check('history: the application keeps the latest reviewer, time and reason', (select reviewed_by = ad and reviewed_at is not null and decision_reason = 'Photo does not match the name' from public.verification_applications where id = app1));
  perform t.check('history: administrators can read it (with actor ids)', t.val(ad,'authenticated', format('select count(*)::text from public.verification_events where application_id = %L and actor_id is not null', app1)) = '1');
  perform t.check('history: another professional cannot read it', t.val(p1,'authenticated', format('select count(*)::text from public.verification_events where application_id = %L', app1)) = '0');
  r := t.try(ad,'authenticated', format('select public.review_verification(%L,''additional_information_required'',''You may resubmit with a clearer photo'')', app1));
  perform t.check('history: reopening is recorded', r = 'ok');
  perform t.check('history: a reopened application keeps earlier decisions', (select count(*) from public.verification_events where application_id = app1 and event_type = 'admin_decision') = 2
     and (select string_agg(to_status::text, '>' order by created_at, id) from public.verification_events where application_id = app1 and event_type = 'admin_decision') = 'rejected>additional_information_required');
  perform t.check('history: reopened application returns to the pending view', t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''pending'', p_query => ''Pending One'')') = '1');
  perform t.check('retention: administrators cannot delete verification records', t.fails(t.try(ad,'authenticated', format('delete from public.verification_applications where id = %L', app4)))
     and t.fails(t.try(ad,'authenticated','delete from public.professional_documents')) and t.fails(t.try(ad,'authenticated','delete from public.verification_events')));

  -- the application shows only the latest decision; earlier reasons stay in the history
  insert into public.professional_documents(professional_id,requirement_id,storage_path,file_name,review_status,uploaded_at) values (q1,req,'av/'||q1||'/id.jpg','id.jpg','accepted',now());
  r := t.try(ad,'authenticated', format('select public.review_verification(%L,''approved'')', app1));
  perform t.check('latest decision: approval after a rejection succeeds without a reason', r = 'ok');
  perform t.check('latest decision: the old rejection reason no longer sits beside Approved', (select decision_reason is null and status = 'approved' from public.verification_applications where id = app1));
  perform t.check('latest decision: the earlier rejection reason is still in the history', exists (select 1 from public.verification_events where application_id = app1 and message = 'Photo does not match the name'));
  perform t.check('latest decision: the list shows the new state with no stale reason', t.val(ad,'authenticated','select coalesce(decision_reason, ''none'') from public.admin_list_professionals(p_group => ''approved'', p_query => ''Pending One'')') = 'none');

  -- detail data is reachable by administrators only, including removed documents
  perform t.check('detail: administrators see removed documents flagged as removed', t.val(ad,'authenticated', format('select count(*)::text from public.professional_documents where professional_id = %L and deleted_at is not null', q2)) = '1');
  perform t.check('detail: administrators read profile, business, services, coverage and policy records',
     t.val(ad,'authenticated', format('select count(*)::text from public.businesses where id = (select business_id from public.professional_profiles where id = %L)', q3)) = '1'
     and t.val(ad,'authenticated','select count(*)::text from public.policy_acceptances')::int >= 0
     and t.val(ad,'authenticated', format('select count(*)::text from public.service_locations where professional_id = %L', q6)) = '1');
  perform t.check('detail: other professionals and customers cannot read those records', t.val(p1,'authenticated', format('select count(*)::text from public.professional_documents where professional_id = %L', q2)) = '0'
     and t.val(c1,'authenticated', format('select count(*)::text from public.verification_applications where id = %L', app1)) = '0'
     and t.val(c1,'authenticated', format('select count(*)::text from public.businesses where id = (select business_id from public.professional_profiles where id = %L)', q3)) = '0');
end $$;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
select label as failed_check from t.results where not ok;
do $$ begin if exists (select 1 from t.results where not ok) then raise exception 'database tests failed'; end if; end $$;
