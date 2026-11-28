-- Stage 4 professional workspace: dashboard figures, customers and notes, sensitive-change review, job progress.
do $$
declare ad uuid := '00000000-0000-0000-0000-0000000000ad'; w1 uuid := '00000000-0000-0000-0000-000000000b01'; w2 uuid := '00000000-0000-0000-0000-000000000b02'; w3 uuid := '00000000-0000-0000-0000-000000000b03';
        wc1 uuid := '00000000-0000-0000-0000-000000000c01'; wc2 uuid := '00000000-0000-0000-0000-000000000c02';
        pl uuid; el uuid; warri uuid; q1 uuid; q2 uuid; q3 uuid; b1 uuid; b2 uuid; b3 uuid; b4 uuid; qt1 uuid; qt2 uuid; r text; v text; tx uuid; cat1 uuid; conv uuid;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select id into pl from public.service_categories where slug = 'plumbing'; select id into el from public.service_categories where slug = 'electrical'; select id into warri from public.locations where slug = 'zz-warri';
  insert into auth.users(id,email,raw_user_meta_data) values
    (w1,'w1@t','{"role":"professional","full_name":"WS Pro One"}'),(w2,'w2@t','{"role":"professional","full_name":"WS Pro Two"}'),(w3,'w3@t','{"role":"professional","full_name":"WS Biz Three"}'),
    (wc1,'wc1@t','{"role":"customer","full_name":"Ngozi Adeyemi"}'),(wc2,'wc2@t','{"role":"customer","full_name":"Tunde"}');
  insert into public.professional_profiles(user_id,slug,display_name,headline,primary_category_id,account_type,verification_status,is_listed) values
    (w1,'ws-pro-one','WS Pro One','Plumber',pl,'individual','approved',true),(w2,'ws-pro-two','WS Pro Two','Electrician',el,'individual','approved',true),(w3,'ws-biz-three','WS Biz Three','Pipes',pl,'business','approved',true);
  select id into q1 from public.professional_profiles where user_id = w1; select id into q2 from public.professional_profiles where user_id = w2; select id into q3 from public.professional_profiles where user_id = w3;
  insert into public.verification_applications(professional_id,status,submitted_at,reviewed_by,reviewed_at) values (q1,'approved',now(),ad,now()),(q2,'approved',now(),ad,now()),(q3,'approved',now(),ad,now());
  insert into public.businesses(owner_user_id, registered_name, registration_number, email) values (w3,'Three Pipes Ltd','RC111','b@t');
  update public.professional_profiles set business_id = (select id from public.businesses where owner_user_id = w3) where id = q3;
  insert into public.professional_services(professional_id,category_id,name,pricing_type,price_minor) values (q1,pl,'Leak repair','starting',500000),(q2,el,'Wiring','starting',700000);

  -- enquiries from customers
  b1 := t.val(wc1,'authenticated', format('select public.request_quotation(%L,null,''Leak'',''Kitchen leak'')', q1))::uuid;
  b2 := t.val(wc1,'authenticated', format('select public.request_quotation(%L,null,''Pipe'',''New pipe'')', q1))::uuid;
  b3 := t.val(wc2,'authenticated', format('select public.request_quotation(%L,null,''Tap'',''Tap'')', q1))::uuid;
  b4 := t.val(wc2,'authenticated', format('select public.request_quotation(%L,null,''Wire'',''Wiring'')', q2))::uuid;
  perform t.check('dashboard: three new enquiries for professional one', (t.val(w1,'authenticated','select public.professional_dashboard() ->> ''enquiries_new''')) = '3');
  -- run b2 all the way to completed through the existing workflow functions
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.quotations(booking_id,professional_id,customer_id) values (b2,q1,wc1) returning id into qt1;
  insert into public.quotations(booking_id,professional_id,customer_id) values (b1,q1,wc1) returning id into qt2;
  perform t.try(w1,'authenticated', format('insert into public.quotation_items(quotation_id,kind,description,quantity,unit_price_minor) values (%L,''labour'',''Fit pipe'',1,2000000),(%L,''labour'',''Look'',1,300000)', qt1, qt2));
  perform t.check('quotes: drafts are counted', t.val(w1,'authenticated','select public.professional_dashboard() ->> ''quotations_draft''') = '2');
  r := t.try(w1,'authenticated', format('select public.send_quotation(%L)', qt1)); perform t.check('quotes: professional sends', r = 'ok');
  r := t.try(w1,'authenticated', format('select public.send_quotation(%L)', qt2));
  perform t.check('dashboard: sent quotations awaiting the customer', t.val(w1,'authenticated','select public.professional_dashboard() ->> ''quotations_pending''') = '2');
  r := t.try(wc1,'authenticated', format('select public.approve_quotation(%L)', qt1)); perform t.check('customer approves', r = 'ok');
  perform t.check('dashboard: upcoming booking', t.val(w1,'authenticated','select public.professional_dashboard() ->> ''bookings_upcoming''') = '1');
  perform t.check('jobs: professional schedules', t.try(w1,'authenticated', format('select public.transition_booking(%L,''scheduled'')', b2)) = 'ok');
  perform t.check('jobs: professional starts', t.try(w1,'authenticated', format('select public.transition_booking(%L,''in_progress'')', b2)) = 'ok');
  perform t.check('jobs: progress notes allowed while in progress', t.try(w1,'authenticated', format('insert into public.job_updates(booking_id,author_id,message) values (%L,%L,''Pipe fitted'')', b2, w1)) = 'ok');
  perform t.check('dashboard: active job', t.val(w1,'authenticated','select public.professional_dashboard() ->> ''jobs_active''') = '1');
  perform t.check('jobs: professional submits for confirmation', t.try(w1,'authenticated', format('select public.transition_booking(%L,''awaiting_customer_confirmation'')', b2)) = 'ok');
  perform t.check('jobs: professional cannot mark a job completed themselves', t.fails(t.try(w1,'authenticated', format('select public.transition_booking(%L,''completed'')', b2))));
  perform t.check('jobs: customer confirms', t.try(wc1,'authenticated', format('select public.transition_booking(%L,''completed'')', b2)) = 'ok');
  perform t.check('jobs: no progress notes after completion', t.fails(t.try(w1,'authenticated', format('insert into public.job_updates(booking_id,author_id,message) values (%L,%L,''late'')', b2, w1))));
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.payment_transactions(booking_id,customer_id,professional_id,provider,provider_reference,idempotency_key,amount_minor) values (b2,wc1,q1,'paystack','ws1','wk1',2000000) returning id into tx;
  insert into public.commissions(transaction_id,booking_id,rate_bps,amount_minor) values (tx,b2,500,100000);
  update public.platform_settings set value = jsonb_set(value, '{protected_payments_enabled}', 'true') where key = 'features';
  insert into public.payouts(professional_id,booking_id,amount_minor,status) values (q1,b2,1900000,'pending');
  update public.platform_settings set value = jsonb_set(value, '{protected_payments_enabled}', 'false') where key = 'features';
  v := t.val(w1,'authenticated','select public.professional_dashboard()::text');
  perform t.check('dashboard: completed jobs, gross, commission and pending payout come from real records',
     (v::jsonb ->> 'jobs_completed') = '1' and (v::jsonb ->> 'gross_completed_minor') = '2000000' and (v::jsonb ->> 'commission_minor') = '100000' and (v::jsonb ->> 'payout_pending_minor') = '1900000' and (v::jsonb ->> 'payout_paid_minor') = '0');
  perform t.check('dashboard: status breakdown for the analytics funnel', (v::jsonb -> 'by_status' ->> 'completed') = '1' and (v::jsonb -> 'by_status' ->> 'awaiting_approval') = '1' and (v::jsonb -> 'by_status' ->> 'quotation_requested') = '1');
  -- messages
  select conversation_id into conv from public.bookings where id = b2;
  perform t.check('messages: customer writes', t.try(wc1,'authenticated', format('insert into public.messages(conversation_id,sender_id,body) values (%L,%L,''Hello''),(%L,%L,''Any update?'')', conv, wc1, conv, wc1)) = 'ok');
  perform t.check('dashboard: unread messages', t.val(w1,'authenticated','select public.professional_dashboard() ->> ''unread_messages''') = '2');
  perform t.check('messages: reading marks them read', t.try(w1,'authenticated', format('update public.conversation_participants set last_read_at = now() + interval ''1 second'' where conversation_id = %L and user_id = %L', conv, w1)) = 'ok'
     and t.val(w1,'authenticated','select public.professional_dashboard() ->> ''unread_messages''') = '0');

  -- isolation
  perform t.check('dashboard: another professional sees only their own figures', t.val(w2,'authenticated','select public.professional_dashboard() ->> ''enquiries_new''') = '1' and t.val(w2,'authenticated','select public.professional_dashboard() ->> ''gross_completed_minor''') = '0');
  perform t.check('dashboard: customers get nothing', t.val(wc1,'authenticated','select public.professional_dashboard()::text') = '{}');
  perform t.check('dashboard: anonymous visitors are refused', t.fails(t.try(null,'anon','select public.professional_dashboard()')));

  -- customers and notes
  perform t.check('customers: lists customers with masked names and counts', t.val(w1,'authenticated','select string_agg(display_name || '':'' || bookings_count || '':'' || completed_count, '','' order by display_name) from public.professional_customers()') = 'Ngozi A.:2:1,Tunde:1:0');
  perform t.check('customers: another professional sees only theirs', t.val(w2,'authenticated','select string_agg(display_name, '','') from public.professional_customers()') = 'Tunde');
  perform t.check('customers: no contact details in the result', pg_get_function_result('public.professional_customers()'::regprocedure) !~* '(email|phone)');
  perform t.check('customers: customers and anonymous visitors get nothing', t.val(wc1,'authenticated','select count(*)::text from public.professional_customers()') = '0' and t.fails(t.try(null,'anon','select * from public.professional_customers()')));
  perform t.check('notes: professional saves a note for a customer they dealt with', t.try(w1,'authenticated', format('insert into public.professional_customer_notes(professional_id,customer_id,note) values (%L,%L,''Prefers mornings'')', q1, wc1)) = 'ok');
  perform t.check('notes: appear in the customer list', t.val(w1,'authenticated','select note from public.professional_customers() where display_name = ''Ngozi A.''') = 'Prefers mornings');
  perform t.check('notes: not for strangers', t.fails(t.try(w2,'authenticated', format('insert into public.professional_customer_notes(professional_id,customer_id,note) values (%L,%L,''x'')', q2, wc1))));
  perform t.check('notes: private from other professionals, customers and administrators', t.val(w2,'authenticated','select count(*)::text from public.professional_customer_notes') = '0'
     and t.val(wc1,'authenticated','select count(*)::text from public.professional_customer_notes') = '0' and t.val(ad,'authenticated','select count(*)::text from public.professional_customer_notes') = '0');
  perform t.check('notes: cannot write into another professional''s notebook', t.fails(t.try(w2,'authenticated', format('insert into public.professional_customer_notes(professional_id,customer_id,note) values (%L,%L,''x'')', q1, wc2))));

  -- sensitive changes after approval
  r := t.try(w1,'authenticated', format('update public.professional_profiles set headline = ''Master plumber'', bio = ''Updated'' where id = %L', q1));
  perform t.check('profile: ordinary edits keep the approval', r = 'ok' and (select verification_status = 'approved' and is_listed from public.professional_profiles where id = q1));
  r := t.try(w1,'authenticated', format('update public.professional_profiles set primary_category_id = %L where id = %L', el, q1));
  perform t.check('profile: changing the main category after approval returns it to review', r = 'ok');
  perform t.check('profile: it is unlisted while under review', (select verification_status = 'under_review' and not is_listed from public.professional_profiles where id = q1)
     and t.val(null,'anon','select count(*)::text from public.public_professionals where slug = ''ws-pro-one''') = '0');
  perform t.check('profile: the change is recorded in the history with the professional as actor', exists (select 1 from public.verification_events e join public.verification_applications a on a.id = e.application_id where a.professional_id = q1 and e.event_type = 'sensitive_change' and e.actor_id = w1));
  perform t.check('profile: it appears in the administrators'' pending view', t.val(ad,'authenticated','select count(*)::text from public.admin_list_professionals(p_group => ''pending'', p_query => ''WS Pro One'')') = '1');
  perform t.check('profile: the professional cannot restore approval themselves', t.fails(t.try(w1,'authenticated', format('update public.professional_profiles set verification_status = ''approved'', is_listed = true where id = %L', q1))));
  r := t.try(w3,'authenticated', format('update public.businesses set email = ''new@t'' where owner_user_id = %L', w3));
  perform t.check('business: contact changes keep the approval', r = 'ok' and (select verification_status = 'approved' from public.professional_profiles where id = q3));
  r := t.try(w3,'authenticated', format('update public.businesses set registered_name = ''Another Name Ltd'' where owner_user_id = %L', w3));
  perform t.check('business: changing the registered name returns it to review', r = 'ok' and (select verification_status = 'under_review' and not is_listed from public.professional_profiles where id = q3));
  perform t.check('profile: administrator edits do not trigger a re-review', (select count(*) from public.verification_events e join public.verification_applications a on a.id = e.application_id where a.professional_id = q2 and e.event_type = 'sensitive_change') = 0);
end $$;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
select label as failed_check from t.results where not ok;
do $$ begin if exists (select 1 from t.results where not ok) then raise exception 'database tests failed'; end if; end $$;
