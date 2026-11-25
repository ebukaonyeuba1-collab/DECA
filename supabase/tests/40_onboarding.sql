-- Stage 3 onboarding tests: consent at sign-up, policy acceptance, applicable requirements, bucket limits.
do $$
declare u1 uuid := '00000000-0000-0000-0000-0000000000b1'; u2 uuid := '00000000-0000-0000-0000-0000000000b2'; u3 uuid := '00000000-0000-0000-0000-0000000000b3';
        warri uuid; pid uuid; cat uuid; n int; r text;
begin
  select id into warri from public.locations where slug = 'zz-warri';
  insert into auth.users(id,email,raw_user_meta_data) values
    (u1,'b1@t', jsonb_build_object('role','customer','full_name','Onboard Customer','phone','+2348012345678','privacy_consent','true','marketing_consent','true','location_id', warri)),
    (u2,'b2@t', '{"role":"professional","full_name":"Onboard Pro"}'),
    (u3,'b3@t', jsonb_build_object('role','customer','full_name',repeat('x',500),'location_id','00000000-0000-0000-0000-00000000dead'));
  perform t.check('signup: consent and location are recorded for a customer', (select privacy_consent_at is not null and marketing_consent and preferred_location_id = warri from public.customer_profiles where user_id = u1)
     and (select location_id = warri from public.profiles where id = u1));
  perform t.check('signup: phone from metadata is stored on the profile', (select phone from public.profiles where id = u1) = '+2348012345678');
  perform t.check('signup: privacy acceptance recorded at the current version', (select count(*) from public.policy_acceptances where user_id = u1 and policy_key = 'privacy_policy' and version = public.current_policy_version()) = 1);
  perform t.check('signup: no consent means no acceptance record', (select count(*) from public.policy_acceptances where user_id = u3) = 0);
  perform t.check('signup: invalid location id is ignored, long names are truncated', (select location_id is null and char_length(full_name) = 120 from public.profiles where id = u3));
  perform t.check('policy: users read only their own acceptances', t.val(u1,'authenticated','select count(*)::text from public.policy_acceptances') = '1' and t.val(u2,'authenticated','select count(*)::text from public.policy_acceptances') = '0');
  perform t.check('policy: clients cannot write acceptances directly', t.fails(t.try(u2,'authenticated', format('insert into public.policy_acceptances(user_id,policy_key,version) values (%L,''privacy_policy'',''x'')', u2))));
  perform t.check('policy: acceptances are append-only', t.fails(t.try(u1,'authenticated','delete from public.policy_acceptances')) and t.fails(t.try(null,'authenticated','update public.policy_acceptances set version = ''y''')));
  perform t.check('policy: unknown keys are refused', t.fails(t.try(u2,'authenticated','select public.accept_policies(array[''made_up''])')));
  perform t.check('policy: a customer cannot accept professional-only policies', t.fails(t.try(u1,'authenticated','select public.accept_policies(array[''professional_terms''])')));
  perform t.check('policy: professional is not compliant until all are accepted', not public.has_accepted_required_policies(u2));
  r := t.try(u2,'authenticated','select public.accept_policies(array[''professional_terms''])');
  perform t.check('policy: partial acceptance is not enough', r = 'ok' and not public.has_accepted_required_policies(u2));
  r := t.try(u2,'authenticated','select public.accept_policies(array[''professional_terms'',''marketplace_rules'',''verification_policy'',''transaction_policy'',''privacy_policy'',''dispute_policy''])');
  perform t.check('policy: accepting everything succeeds', r = 'ok');
  perform t.check('policy: all required accepted', public.has_accepted_required_policies(u2));
  perform t.check('policy: accepting again is idempotent', t.try(u2,'authenticated','select public.accept_policies(array[''privacy_policy''])') = 'ok');
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.platform_settings set value = jsonb_set(value, '{version}', '"2099-01"') where key = 'policies';
  perform t.check('policy: a new version requires re-acceptance', not public.has_accepted_required_policies(u2));
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.platform_settings set value = jsonb_set(value, '{version}', '"2026-11-24"') where key = 'policies';
  perform t.check('policy: restoring the version restores acceptance', public.has_accepted_required_policies(u2));

  select id into cat from public.service_categories where slug = 'electrical';
  perform t.try(u2,'authenticated', format('insert into public.professional_profiles(user_id,slug,display_name,primary_category_id) values (%L,''onboard-pro'',''Onboard Pro'',%L)', u2, cat));
  select id into pid from public.professional_profiles where user_id = u2;
  perform t.check('requirements: owner sees baseline plus category requirements (optional included)', t.val(u2,'authenticated', format('select count(*)::text from public.applicable_requirements(%L)', pid))::int >= 2);
  perform t.check('requirements: only required ones gate submission', t.val(u2,'authenticated', format('select count(*)::text from public.required_documents_for(%L)', pid)) = '1');
  perform t.check('requirements: another user cannot enumerate them', t.val(u1,'authenticated', format('select count(*)::text from public.applicable_requirements(%L)', pid)) = '0');
  perform t.check('onboarding: professionals can create services, coverage and availability on their own profile',
     t.try(u2,'authenticated', format('insert into public.professional_services(professional_id,category_id,name,pricing_type,price_minor) values (%L,%L,''Wiring'',''starting'',500000)', pid, cat)) = 'ok'
     and t.try(u2,'authenticated', format('insert into public.service_locations(professional_id,location_id) values (%L,%L)', pid, warri)) = 'ok'
     and t.try(u2,'authenticated', format('insert into public.professional_availability(professional_id,weekday,start_time,end_time) values (%L,1,''08:00'',''17:00'')', pid)) = 'ok');
  perform t.check('onboarding: nobody else can write to that profile', t.fails(t.try(u1,'authenticated', format('insert into public.professional_services(professional_id,category_id,name,pricing_type,price_minor) values (%L,%L,''Hijack'',''fixed'',1)', pid, cat))));
  perform t.check('onboarding: a customer cannot create a professional profile', t.fails(t.try(u1,'authenticated', format('insert into public.professional_profiles(user_id,slug,display_name) values (%L,''sneaky'',''Sneaky'')', u1))));
  perform t.check('onboarding: services stay private until approval', t.val(null,'anon','select count(*)::text from public.public_professional_services where name = ''Wiring'' and professional_id = ' || quote_literal(pid)) = '0');
  perform t.check('storage: public bucket limited to 5 MB images', (select file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg','image/png','image/webp'] from storage.buckets where id = 'public-media'));
  perform t.check('storage: user can write only inside their own public-media folder', t.try(u2,'authenticated', format('insert into storage.objects(bucket_id,name,owner) values (''public-media'',%L,%L)', u2||'/avatar/a.jpg', u2)) = 'ok'
     and t.fails(t.try(u2,'authenticated', format('insert into storage.objects(bucket_id,name,owner) values (''public-media'',%L,%L)', u1||'/avatar/a.jpg', u2))));
end $$;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
select label as failed_check from t.results where not ok;
do $$ begin if exists (select 1 from t.results where not ok) then raise exception 'database tests failed'; end if; end $$;
