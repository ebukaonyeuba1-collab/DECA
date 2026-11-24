-- Stage 1 security and workflow smoke test. Requires 05_test_helpers.sql. Prints PASS/FAIL lines.
do $$
declare c1 uuid := '00000000-0000-0000-0000-0000000000c1'; c2 uuid := '00000000-0000-0000-0000-0000000000c2';
        p1 uuid := '00000000-0000-0000-0000-0000000000a1'; p2 uuid := '00000000-0000-0000-0000-0000000000a2';
        ad uuid := '00000000-0000-0000-0000-0000000000ad'; pid1 uuid; pid2 uuid; cat uuid; req uuid; aid uuid;
        bid uuid; qid uuid; r text; n bigint; v text; docid uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
   (c1,'c1@t','{"role":"customer","full_name":"Cust One"}'),(c2,'c2@t','{"role":"customer"}'),
   (p1,'p1@t','{"role":"professional","full_name":"Pro One"}'),(p2,'p2@t','{"role":"professional"}'),
   (ad,'ad@t','{"role":"admin"}');
  perform t.check('metadata cannot self-grant admin', (select role from public.profiles where id = ad) = 'customer');
  perform t.try(null, 'service_role', format('update public.profiles set role = ''admin'' where id = %L', ad));
  perform t.check('service role can grant admin', (select role from public.profiles where id = ad) = 'admin');

  -- privilege escalation attempts
  perform t.check('customer cannot change own role', t.fails(t.try(c1,'authenticated', format('update public.profiles set role = ''admin'' where id = %L', c1))));
  perform t.check('customer cannot reactivate/alter status', t.fails(t.try(c1,'authenticated', format('update public.profiles set status = ''suspended'' where id = %L', c1))));
  perform t.check('anon cannot read profiles', t.val(null,'anon','select count(*)::text from public.profiles') in ('0') or t.val(null,'anon','select count(*)::text from public.profiles') like 'ERR%');

  -- professional onboarding and verification
  select id into cat from public.service_categories where slug = 'plumbing';
  perform t.try(p1,'authenticated', format('insert into public.professional_profiles(user_id,slug,display_name,primary_category_id,verification_status,is_listed) values (%L,''pro-one-plumbing'',''Pro One Plumbing'',%L,''approved'',true)', p1, cat));
  select id into pid1 from public.professional_profiles where user_id = p1;
  perform t.check('insert forces verification_status=not_started and unlisted', (select verification_status::text||is_listed::text from public.professional_profiles where id = pid1) = 'not_startedfalse');
  perform t.try(p2,'authenticated', format('insert into public.professional_profiles(user_id,slug,display_name,primary_category_id) values (%L,''pro-two'',''Pro Two'',%L)', p2, cat));
  select id into pid2 from public.professional_profiles where user_id = p2;
  perform t.check('professional cannot approve themselves', t.fails(t.try(p1,'authenticated', format('update public.professional_profiles set verification_status = ''approved'', is_listed = true where id = %L', pid1))));
  perform t.check('unapproved professional hidden from anon', t.val(null,'anon','select count(*)::text from public.public_professionals') = '0');
  perform t.check('submit blocked while documents missing', t.fails(t.try(p1,'authenticated','select public.submit_verification_application()')));
  select id into req from public.verification_requirements where kind = 'identity';
  docid := gen_random_uuid();
  perform t.try(p1,'authenticated', format('insert into public.professional_documents(id,professional_id,requirement_id,storage_path,file_name,review_status) values (%L,%L,%L,%L,''id.jpg'',''accepted'')', docid, pid1, req, p1||'/'||docid||'/id.jpg'));
  perform t.check('document review_status forced to pending', (select review_status::text from public.professional_documents where professional_id = pid1) = 'pending');
  perform t.check('submit blocked until the file is confirmed in storage', t.fails(t.try(p1,'authenticated','select public.submit_verification_application()')));
  insert into storage.objects(bucket_id, name, owner) values ('verification-documents', p1||'/'||docid||'/id.jpg', p1);
  perform t.check('owner confirms upload', t.try(p1,'authenticated', format('select public.confirm_document_upload(%L)', docid)) = 'ok');
  perform t.check('submit works with required documents', t.try(p1,'authenticated','select public.submit_verification_application()') = 'ok');
  select id into aid from public.verification_applications where professional_id = pid1;
  perform t.check('professional cannot decide own application', t.fails(t.try(p1,'authenticated', format('select public.review_verification(%L,''approved'')', aid))));
  perform t.check('customer cannot decide applications', t.fails(t.try(c1,'authenticated', format('select public.review_verification(%L,''approved'')', aid))));
  perform t.check('rejection needs a reason', t.fails(t.try(ad,'authenticated', format('select public.review_verification(%L,''rejected'')', aid))));
  perform t.check('approval blocked while required documents are unaccepted', t.fails(t.try(ad,'authenticated', format('select public.review_verification(%L,''approved'')', aid))));
  perform t.check('only admins review documents', t.fails(t.try(p1,'authenticated', format('select public.review_document(%L,''accepted'')', docid))));
  perform t.check('admin accepts document', t.try(ad,'authenticated', format('select public.review_document(%L,''accepted'')', docid)) = 'ok');
  perform t.check('admin approves', t.try(ad,'authenticated', format('select public.review_verification(%L,''approved'')', aid)) = 'ok');
  perform t.check('approved professional appears publicly', t.val(null,'anon','select count(*)::text from public.public_professionals') = '1');
  perform t.check('other professional cannot read documents', t.val(p2,'authenticated','select count(*)::text from public.professional_documents') = '0');
  perform t.check('anon cannot read documents', t.val(null,'anon','select count(*)::text from public.professional_documents') like 'ERR%');
  perform t.check('admin actions are audit logged', (select count(*) from public.admin_audit_logs) > 0);

  -- marketplace flow
  bid := t.val(c1,'authenticated', format('select public.request_quotation(%L,null,''Leaking sink'',''Kitchen sink leaks'')', pid1))::uuid;
  perform t.check('customer requests quotation', bid is not null);
  perform t.check('professional cannot request as customer', t.fails(t.try(p1,'authenticated', format('select public.request_quotation(%L,null,''x'',''y'')', pid1))));
  perform t.check('unlisted professional cannot be requested', t.fails(t.try(c1,'authenticated', format('select public.request_quotation(%L,null,''x'',''y'')', pid2))));
  perform t.check('other customer cannot see booking', t.val(c2,'authenticated','select count(*)::text from public.bookings') = '0');
  perform t.check('customer cannot write booking status directly', t.fails(t.try(c1,'authenticated', format('update public.bookings set status = ''completed'' where id = %L', bid))));
  insert into public.quotations(id, booking_id, professional_id, customer_id) values (gen_random_uuid(), bid, pid1, c1) returning id into qid;
  perform t.check('professional cannot send empty quotation', t.fails(t.try(p1,'authenticated', format('select public.send_quotation(%L)', qid))));
  perform t.try(p1,'authenticated', format('insert into public.quotation_items(quotation_id,kind,description,quantity,unit_price_minor) values (%L,''labour'',''Repair'',1,1200000),(%L,''material'',''Pipe'',2,250000),(%L,''discount'',''Loyalty'',1,100000)', qid,qid,qid));
  perform t.check('total is computed from items (labour+material-discount)', (select total_minor from public.quotations where id = qid) = 1600000);
  perform t.check('professional sends quotation', t.try(p1,'authenticated', format('select public.send_quotation(%L)', qid)) = 'ok');
  perform t.check('booking awaits approval', (select status::text from public.bookings where id = bid) = 'awaiting_approval');
  perform t.try(p1,'authenticated', format('update public.quotations set total_minor = 1 where id = %L', qid));
  perform t.check('sent quotation cannot be edited (RLS hides non-draft rows)', (select total_minor from public.quotations where id = qid) = 1600000);
  perform t.check('items locked after send', t.fails(t.try(p1,'authenticated', format('insert into public.quotation_items(quotation_id,kind,description,unit_price_minor) values (%L,''additional'',''x'',1)', qid))));
  perform t.check('other customer cannot approve', t.fails(t.try(c2,'authenticated', format('select public.approve_quotation(%L)', qid))));
  perform t.check('customer approves', t.try(c1,'authenticated', format('select public.approve_quotation(%L)', qid)) = 'ok');
  perform t.check('booking confirmed with agreed amount snapshot', (select status::text||agreed_amount_minor::text from public.bookings where id = bid) = 'confirmed1600000');
  perform t.check('agreed snapshot is immutable', t.fails(t.try(null,'service_role', format('update public.bookings set agreed_amount_minor = 5 where id = %L', bid))));
  perform t.check('customer cannot start job (illegal transition)', t.fails(t.try(c1,'authenticated', format('select public.transition_booking(%L,''in_progress'')', bid))));
  perform t.check('professional cannot mark completed', t.fails(t.try(p1,'authenticated', format('select public.transition_booking(%L,''completed'')', bid))));
  perform t.check('professional schedules', t.try(p1,'authenticated', format('select public.transition_booking(%L,''scheduled'')', bid)) = 'ok');
  perform t.check('professional starts', t.try(p1,'authenticated', format('select public.transition_booking(%L,''in_progress'')', bid)) = 'ok');
  perform t.check('review blocked before completion', t.fails(t.try(c1,'authenticated', format('insert into public.reviews(booking_id,customer_id,professional_id,rating_overall) values (%L,%L,%L,5)', bid,c1,pid1))));
  perform t.check('professional submits for confirmation', t.try(p1,'authenticated', format('select public.transition_booking(%L,''awaiting_customer_confirmation'')', bid)) = 'ok');
  perform t.check('payment record can be created server-side', t.try(null,'service_role', format('insert into public.payment_transactions(booking_id,customer_id,professional_id,provider,provider_reference,idempotency_key,amount_minor) values (%L,%L,%L,''paystack'',''r1'',''k1'',1600000)', bid,c1,pid1)) = 'ok');
  perform t.check('commission blocked before completion', t.fails(t.try(null,'service_role', format('insert into public.commissions(transaction_id,booking_id,rate_bps,amount_minor) select id,%L,500,1 from public.payment_transactions where provider_reference = ''r1''', bid))));
  perform t.check('customer confirms completion', t.try(c1,'authenticated', format('select public.transition_booking(%L,''completed'')', bid)) = 'ok');
  perform t.check('commission recorded after completion', t.try(null,'service_role', format('insert into public.commissions(transaction_id,booking_id,rate_bps,amount_minor) select id,%L,500,80000 from public.payment_transactions where provider_reference = ''r1''', bid)) = 'ok');
  perform t.check('completed job counted', (select completed_jobs from public.professional_profiles where id = pid1) = 1);
  perform t.check('customer reviews completed job', t.try(c1,'authenticated', format('insert into public.reviews(booking_id,customer_id,professional_id,rating_overall) values (%L,%L,%L,4)', bid,c1,pid1)) = 'ok');
  perform t.check('duplicate review blocked', t.fails(t.try(c1,'authenticated', format('insert into public.reviews(booking_id,customer_id,professional_id,rating_overall) values (%L,%L,%L,5)', bid,c1,pid1))));
  perform t.check('rating derived from real reviews', (select rating_avg::text||review_count::text from public.professional_profiles where id = pid1) = '4.001');
  perform t.check('other customer cannot review', t.fails(t.try(c2,'authenticated', format('insert into public.reviews(booking_id,customer_id,professional_id,rating_overall) values (%L,%L,%L,1)', bid,c2,pid1))));

  -- money and logs
  perform t.check('users cannot forge payment records', t.fails(t.try(c1,'authenticated', format('insert into public.payment_transactions(booking_id,customer_id,professional_id,provider,provider_reference,idempotency_key,amount_minor,status) values (%L,%L,%L,''paystack'',''fake'',''fk'',1,''succeeded'')', bid,c1,pid1))));
  perform t.check('webhook replay protected', (t.try(null,'service_role', 'insert into public.payment_events(provider,provider_event_id,event_type,signature_valid,payload) values (''paystack'',''e1'',''charge.success'',true,''{}'')') = 'ok')
     and t.fails(t.try(null,'service_role', 'insert into public.payment_events(provider,provider_event_id,event_type,signature_valid,payload) values (''paystack'',''e1'',''charge.success'',true,''{}'')')));
  perform t.check('ledger accepts server-side entries', t.try(null,'service_role','insert into public.ledger_entries(account,direction,amount_minor) values (''customer'',''debit'',5)') = 'ok');
  perform t.check('ledger is append-only', t.fails(t.try(null,'service_role','update public.ledger_entries set amount_minor = 1')) and t.fails(t.try(null,'service_role','delete from public.ledger_entries')));
  perform t.check('audit log is append-only', t.fails(t.try(null,'service_role','delete from public.admin_audit_logs')));
  perform t.check('customer cannot read audit logs', t.val(c1,'authenticated','select count(*)::text from public.admin_audit_logs') = '0');

  -- messaging and disputes
  perform t.check('participants see their conversation', t.val(c1,'authenticated','select count(*)::text from public.conversations') = '1');
  perform t.check('outsider cannot read conversation', t.val(c2,'authenticated','select count(*)::text from public.conversations') = '0');
  select id::text into v from public.conversations limit 1;
  perform t.check('outsider cannot post message', t.fails(t.try(c2,'authenticated', format('insert into public.messages(conversation_id,sender_id,body) values (%L,%L,''hi'')', v, c2))));
  perform t.check('cannot impersonate sender', t.fails(t.try(c1,'authenticated', format('insert into public.messages(conversation_id,sender_id,body) values (%L,%L,''hi'')', v, p1))));
  perform t.check('participant can message', t.try(c1,'authenticated', format('insert into public.messages(conversation_id,sender_id,body) values (%L,%L,''hello'')', v, c1)) = 'ok');
  perform t.check('admin can read conversation', t.val(ad,'authenticated','select count(*)::text from public.messages') = '1');
  perform t.check('dispute needs a booking participant', t.fails(t.try(c2,'authenticated', format('select public.raise_dispute(%L,''x'')', bid))));
  perform t.check('customer raises dispute on completed booking', t.try(c1,'authenticated', format('select public.raise_dispute(%L,''Work not finished'')', bid)) = 'ok');
  perform t.check('booking marked disputed', (select status::text from public.bookings where id = bid) = 'disputed');
  perform t.check('customer cannot resolve dispute', t.fails(t.try(c1,'authenticated','update public.disputes set status = ''resolved''')) or (select status::text from public.disputes) <> 'resolved');
  perform t.check('admin resolves dispute', t.try(ad,'authenticated','update public.disputes set status = ''resolved'', resolution_notes = ''ok''') = 'ok');

  -- suspension removes public listing
  perform t.try(ad,'authenticated', format('update public.profiles set status = ''suspended'' where id = %L', p1));
  perform t.check('suspended professional leaves discovery', t.val(null,'anon','select count(*)::text from public.public_professionals') = '0');
  perform t.check('discovery reference data is public', t.val(null,'anon','select count(*)::text from public.service_categories') = '18');
  perform t.check('nigeria locations seeded (country + 37 states)', (select count(*) from public.locations) = 38);
end $$;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
select label as failed_check from t.results where not ok;
