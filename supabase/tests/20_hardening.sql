-- Stage 1 refinement tests: evidence protection, storage, public discovery, payment trust. Run after 10_smoke.sql.
do $$
declare ad uuid := '00000000-0000-0000-0000-0000000000ad'; hc uuid := '00000000-0000-0000-0000-0000000000f1';
        hp uuid := '00000000-0000-0000-0000-0000000000f2'; hp2 uuid := '00000000-0000-0000-0000-0000000000f3';
        c1 uuid := '00000000-0000-0000-0000-0000000000c1'; p1 uuid := '00000000-0000-0000-0000-0000000000a1';
        pid uuid; pid2 uuid; cat uuid; req uuid; aid uuid; docA uuid := gen_random_uuid(); docB uuid := gen_random_uuid(); docC uuid := gen_random_uuid();
        pa text; pb text; pc text; n bigint; tbl text; r text; v text; pidp1 uuid; svc uuid;
begin
  insert into auth.users(id,email,phone,raw_user_meta_data) values
    (hc,'hc@t','+2348000000001','{"role":"customer","full_name":"Hard Customer"}'),
    (hp,'hp@t','+2348000000002','{"role":"professional","full_name":"Hard Pro"}'),
    (hp2,'hp2@t','+2348000000003','{"role":"professional","full_name":"Other Pro"}');
  select id into cat from public.service_categories where slug = 'electrical';
  perform t.try(hp,'authenticated', format('insert into public.professional_profiles(user_id,slug,display_name,primary_category_id) values (%L,''hard-pro'',''Hard Pro Electrical'',%L)', hp, cat));
  perform t.try(hp2,'authenticated', format('insert into public.professional_profiles(user_id,slug,display_name,primary_category_id) values (%L,''other-pro'',''Other Pro'',%L)', hp2, cat));
  select id into pid from public.professional_profiles where user_id = hp;
  select id into pid2 from public.professional_profiles where user_id = hp2;
  select id into req from public.verification_requirements where kind = 'identity';
  pa := hp||'/'||docA||'/id.jpg'; pb := hp||'/'||docB||'/extra.pdf'; pc := hp||'/'||docC||'/id2.jpg';

  -- ===== A. evidence protection and storage =====
  perform t.try(hp,'authenticated', format('insert into public.professional_documents(id,professional_id,requirement_id,storage_path,file_name) values (%L,%L,%L,%L,''id.jpg''),(%L,%L,null,%L,''extra.pdf'')', docA,pid,req,pa,docB,pid,pb));
  perform t.check('owner can view own documents', t.val(hp,'authenticated','select count(*)::text from public.professional_documents') = '2');
  perform t.check('other professional cannot view documents', t.val(hp2,'authenticated','select count(*)::text from public.professional_documents') = '0');
  perform t.check('storage: upload refused without a matching record', t.fails(t.try(hp,'authenticated', format('insert into storage.objects(bucket_id,name,owner) values (''verification-documents'',%L,%L)', hp||'/random/file.jpg', hp))));
  perform t.check('storage: other user cannot upload to someone else''s record path', t.fails(t.try(hp2,'authenticated', format('insert into storage.objects(bucket_id,name,owner) values (''verification-documents'',%L,%L)', pa, hp2))));
  perform t.check('storage: owner uploads against pending record', t.try(hp,'authenticated', format('insert into storage.objects(bucket_id,name,owner) values (''verification-documents'',%L,%L),(''verification-documents'',%L,%L)', pa, hp, pb, hp)) = 'ok');
  perform t.check('storage: other user cannot read evidence file', t.val(hp2,'authenticated','select count(*)::text from storage.objects where bucket_id = ''verification-documents''') = '0');
  perform t.check('storage: anon cannot read evidence file', t.val(null,'anon','select count(*)::text from storage.objects where bucket_id = ''verification-documents''') = '0');
  perform t.check('storage: owner reads own file', t.val(hp,'authenticated','select count(*)::text from storage.objects where bucket_id = ''verification-documents''') = '2');
  perform t.try(hp,'authenticated','delete from storage.objects where bucket_id = ''verification-documents''');
  perform t.try(hp,'authenticated','update storage.objects set name = name || ''x'' where bucket_id = ''verification-documents''');
  perform t.check('storage: owner cannot delete or rename evidence files', (select count(*) from storage.objects where bucket_id = 'verification-documents' and name in (pa, pb)) = 2);
  perform t.check('storage: admin can read evidence files', t.val(ad,'authenticated', format('select count(*)::text from storage.objects where name in (%L,%L)', pa, pb)) = '2');
  perform t.check('storage: bucket limits enforced (10 MB, jpeg/png/pdf)', (select file_size_limit = 10485760 and allowed_mime_types @> array['application/pdf'] from storage.buckets where id = 'verification-documents'));
  perform t.check('owner confirms both uploads', t.try(hp,'authenticated', format('select public.confirm_document_upload(%L)', docA)) = 'ok' and t.try(hp,'authenticated', format('select public.confirm_document_upload(%L)', docB)) = 'ok');
  perform t.check('storage: a confirmed record cannot receive a second upload', t.fails(t.try(hp,'authenticated', format('insert into storage.objects(bucket_id,name,owner) values (''verification-documents'',%L,%L)', pa||'.v2', hp))));
  perform t.check('db: hard delete of a document is refused', t.fails(t.try(hp,'authenticated', format('delete from public.professional_documents where id = %L', docB))));
  r := t.try(hp,'authenticated', format('update public.professional_documents set deleted_at = now() where id = %L', docB));
  perform t.check('db: owner can soft-remove an unaccepted document before submission', r = 'ok' and (select deleted_at is not null from public.professional_documents where id = docB));
  perform t.check('db: removed document row and file are both retained', (select count(*) from public.professional_documents where id = docB) = 1 and (select count(*) from storage.objects where name = pb) = 1);
  perform t.check('db: removal cannot be undone by the owner', t.fails(t.try(hp,'authenticated', format('update public.professional_documents set deleted_at = null where id = %L', docB))));

  perform t.try(hp,'authenticated','select public.accept_policies(array[''professional_terms'',''marketplace_rules'',''verification_policy'',''transaction_policy'',''privacy_policy'',''dispute_policy''])');
  perform t.check('owner submits verification', t.try(hp,'authenticated','select public.submit_verification_application()') = 'ok');
  select id into aid from public.verification_applications where professional_id = pid;
  perform t.check('locked: owner cannot soft-remove after submission', t.fails(t.try(hp,'authenticated', format('update public.professional_documents set deleted_at = now() where id = %L', docA))));
  perform t.check('locked: owner cannot rename a submitted file', t.fails(t.try(hp,'authenticated', format('update public.professional_documents set file_name = ''x'' where id = %L', docA))));
  perform t.check('locked: owner cannot repoint a submitted file', t.fails(t.try(hp,'authenticated', format('update public.professional_documents set storage_path = %L where id = %L', pb, docA))));
  perform t.check('locked: owner cannot change a review decision', t.fails(t.try(hp,'authenticated', format('update public.professional_documents set review_status = ''accepted'' where id = %L', docA))));
  perform t.check('locked: owner cannot fake upload status or application link', t.fails(t.try(hp,'authenticated', format('update public.professional_documents set uploaded_at = now() + interval ''1 day'' where id = %L', docA))));
  perform t.check('locked: admin cannot repoint a file either', t.fails(t.try(ad,'authenticated', format('update public.professional_documents set storage_path = ''x/y'' where id = %L', docA))));
  perform t.check('locked: admin cannot remove evidence', t.fails(t.try(ad,'authenticated', format('update public.professional_documents set deleted_at = now() where id = %L', docA))));
  perform t.check('locked: admin cannot hard delete evidence', t.fails(t.try(ad,'authenticated', format('delete from public.professional_documents where id = %L', docA))));
  perform t.check('locked: application cannot be deleted by owner', t.fails(t.try(hp,'authenticated', format('delete from public.verification_applications where id = %L', aid))));
  perform t.check('events: owner cannot write events', t.fails(t.try(hp,'authenticated', format('insert into public.verification_events(application_id,event_type) values (%L,''x'')', aid))));
  perform t.try(ad,'authenticated','update public.verification_events set message = ''tampered''');
  perform t.check('events: append-only even for admins', (select count(*) from public.verification_events where message = 'tampered') = 0 and t.fails(t.try(ad,'authenticated','delete from public.verification_events')));
  r := t.try(ad,'authenticated', format('select public.review_document(%L,''accepted'')', docA));
  perform t.check('review: admin decides on document', r = 'ok' and (select review_status::text from public.professional_documents where id = docA) = 'accepted');
  perform t.check('review: rejection requires a reason', t.fails(t.try(ad,'authenticated', format('select public.review_document(%L,''rejected'')', docB))));
  perform t.check('review: decisions are written to the event trail', (select count(*) from public.verification_events where application_id = aid and event_type like 'document_%') >= 1);

  perform t.check('admin requests more information', t.try(ad,'authenticated', format('select public.review_verification(%L,''additional_information_required'',''Please add a clearer photo'')', aid)) = 'ok');
  perform t.try(hp,'authenticated', format('insert into public.professional_documents(id,professional_id,requirement_id,storage_path,file_name) values (%L,%L,%L,%L,''id2.jpg'')', docC, pid, req, pc));
  insert into storage.objects(bucket_id,name,owner) values ('verification-documents', pc, hp);
  perform t.try(hp,'authenticated', format('select public.confirm_document_upload(%L)', docC));
  perform t.try(ad,'authenticated', format('select public.review_document(%L,''rejected'',''blurry'')', docC));
  perform t.check('reopened: owner may remove a rejected document', t.try(hp,'authenticated', format('update public.professional_documents set deleted_at = now() where id = %L', docC)) = 'ok');
  perform t.check('reopened: owner still cannot remove an accepted document', t.fails(t.try(hp,'authenticated', format('update public.professional_documents set deleted_at = now() where id = %L', docA))));
  perform t.check('owner resubmits with accepted evidence', t.try(hp,'authenticated','select public.submit_verification_application()') = 'ok');
  perform t.check('admin approves', t.try(ad,'authenticated', format('select public.review_verification(%L,''approved'')', aid)) = 'ok');

  insert into storage.objects(bucket_id,name,owner) values ('verification-documents', 'ghost/orphan.jpg', ad);
  delete from storage.objects where name = pc;
  perform t.check('reconcile: finds files without records', exists (select 1 from public.reconcile_verification_files() x where false) = false
     and t.val(null,'service_role','select count(*)::text from public.reconcile_verification_files() where issue = ''file_without_record''') = '1');
  perform t.check('reconcile: finds records without files', t.val(null,'service_role','select count(*)::text from public.reconcile_verification_files() where issue = ''record_without_file''') = '1');
  perform t.check('reconcile: restricted to administrators', t.fails(t.try(hp,'authenticated','select * from public.reconcile_verification_files()')));
  delete from storage.objects where name = 'ghost/orphan.jpg';

  -- ===== B. public discovery =====
  perform t.check('public views expose no private columns', (select count(*) from information_schema.columns
     where table_schema = 'public' and (table_name like 'public\_%' or table_name = 'conversation_parties')
       and column_name in ('email','phone','phone_verified_at','user_id','owner_user_id','registration_number','internal_notes','decision_reason',
                           'address_line','account_number','account_last4','bank_name','provider_recipient_code','customer_id','reviewed_by','storage_path')) = 0);
  foreach tbl in array array['professional_profiles','professional_services','service_locations','professional_availability','availability_exceptions','portfolio_items','portfolio_media','reviews','review_responses','businesses','profiles','verification_applications','professional_documents','payout_accounts']
  loop perform t.check('anon cannot read base table ' || tbl, t.fails(t.try(null,'anon','select 1 from public.' || tbl || ' limit 1'))); end loop;
  perform t.try(hp,'authenticated', format('insert into public.businesses(id,owner_user_id,registered_name,registration_number,email,phone,address_line) values (gen_random_uuid(),%L,''Hard Pro Ltd'',''RC123456'',''biz@private.test'',''+2348099999999'',''1 Private Street'')', hp));
  update public.professional_profiles set business_id = (select id from public.businesses where owner_user_id = hp) where id = pid;
  perform t.check('business: only name is public, contact details are not selectable', t.val(null,'anon','select business_name from public.public_professionals where slug = ''hard-pro''') = 'Hard Pro Ltd'
     and t.fails(t.try(null,'anon','select email from public.public_professionals')) and t.fails(t.try(null,'anon','select registration_number from public.public_professionals')));
  perform t.check('approved professional is visible through the view', t.val(null,'anon','select count(*)::text from public.public_professionals where slug = ''hard-pro''') = '1');
  perform t.check('verification flags derive from admin-accepted documents', t.val(null,'anon','select identity_verified::text || credentials_verified::text from public.public_professionals where slug = ''hard-pro''') = 'truefalse');
  perform t.check('unapproved professional stays hidden', t.val(null,'anon','select count(*)::text from public.public_professionals where slug = ''other-pro''') = '0');
  perform t.check('customers cannot read other professionals base rows', t.val(hc,'authenticated','select count(*)::text from public.professional_profiles') = '0');
  perform t.check('professional reads only own base row', t.val(hp,'authenticated','select count(*)::text from public.professional_profiles') = '1');
  select id into svc from public.service_categories where slug = 'electrical';
  perform t.try(hp,'authenticated', format('insert into public.professional_services(professional_id,category_id,name,pricing_type,price_minor) values (%L,%L,''Wiring'',''starting'',500000),(%L,%L,''Hidden service'',''fixed'',1)', pid, svc, pid, svc));
  perform t.try(hp,'authenticated','update public.professional_services set is_active = false where name = ''Hidden service''');
  perform t.check('only active services are public', t.val(null,'anon','select string_agg(name, '','') from public.public_professional_services') like '%Wiring%'
     and t.val(null,'anon','select count(*)::text from public.public_professional_services where name = ''Hidden service''') = '0');
  perform t.try(hp2,'authenticated', format('insert into public.professional_services(professional_id,category_id,name,pricing_type,price_minor) values (%L,%L,''Unapproved service'',''fixed'',100)', pid2, svc));
  perform t.check('services of unapproved professionals are not public', t.val(null,'anon','select count(*)::text from public.public_professional_services where name = ''Unapproved service''') = '0');

  perform t.try(null,'service_role', format('update public.profiles set status = ''active'' where id = %L', p1));     -- reinstate (smoke test suspended it); trigger relists
  select id into pidp1 from public.professional_profiles where user_id = p1;
  perform t.check('reinstated professional relists automatically', t.val(null,'anon','select count(*)::text from public.public_professionals where slug = ''pro-one-plumbing''') = '1');
  perform t.check('public review shows masked reviewer name only', t.val(null,'anon','select reviewer_name from public.public_reviews limit 1') = 'Cust O.');
  perform t.try(null,'service_role','update public.reviews set status = ''hidden''');
  perform t.check('hidden reviews disappear from public view', t.val(null,'anon','select count(*)::text from public.public_reviews') = '0');
  perform t.try(null,'service_role', format('update public.professional_profiles set is_featured = true where id = %L', pidp1));
  perform t.check('sponsored listings are flagged', t.val(null,'anon','select is_sponsored::text from public.public_professionals where slug = ''pro-one-plumbing''') = 'true');
  perform t.check('partner cannot read the other party''s email or phone from profiles', t.val(c1,'authenticated', format('select count(*)::text from public.profiles where id = %L', p1)) = '0');
  perform t.check('conversation parties view returns names only', t.val(c1,'authenticated', format('select display_name from public.conversation_parties where id = %L', p1)) = 'Pro One Plumbing'
     and t.fails(t.try(c1,'authenticated','select email from public.conversation_parties')));
  perform t.check('strangers do not appear in conversation parties', t.val(hc,'authenticated', format('select count(*)::text from public.conversation_parties where id = %L', p1)) = '0');
  perform t.check('payout details are owner-only', t.val(hp2,'authenticated','select count(*)::text from public.payout_accounts') = '0');

  -- ===== C. payment trust =====
  select count(*) into n from public.payment_transactions where provider_reference = 'r1';
  perform t.check('payment fixture exists', n = 1);
  perform t.check('webhook event recorded once', t.val(null,'service_role','select public.record_payment_event(''paystack'',''charge.success:42'',''charge.success'',true,''{}''::jsonb)::text') = 'true');
  v := t.val(null,'service_role','select public.record_payment_event(''paystack'',''charge.success:42'',''charge.success'',true,''{}''::jsonb)::text');
  perform t.check('webhook replay is detected and not re-recorded', v = 'false' and (select count(*) from public.payment_events where provider_event_id = 'charge.success:42') = 1);
  perform t.check('only the server can record events', t.fails(t.try(c1,'authenticated','select public.record_payment_event(''paystack'',''x'',''y'',true,''{}''::jsonb)')) and t.fails(t.try(null,'anon','select public.record_payment_event(''paystack'',''x'',''y'',true,''{}''::jsonb)')));
  perform t.check('frontend cannot mark a payment successful', t.fails(t.try(c1,'authenticated','update public.payment_transactions set status = ''succeeded''')) and t.fails(t.try(hp,'authenticated','update public.payment_transactions set status = ''succeeded''')));
  perform t.check('even the server cannot mark success without provider verification', t.fails(t.try(null,'service_role','update public.payment_transactions set status = ''succeeded'' where provider_reference = ''r1''')));
  perform t.check('verification amount must match', t.fails(t.try(null,'service_role','update public.payment_transactions set status = ''succeeded'', verified_at = now(), verified_amount_minor = 1, verified_currency = ''NGN'' where provider_reference = ''r1''')));
  perform t.check('success accepted with matching server verification', t.try(null,'service_role','update public.payment_transactions set status = ''succeeded'', verified_at = now(), verified_amount_minor = amount_minor, verified_currency = currency, paid_at = now() where provider_reference = ''r1''') = 'ok');
  perform t.check('status cannot move backwards', t.fails(t.try(null,'service_role','update public.payment_transactions set status = ''initiated'' where provider_reference = ''r1''')));
  perform t.check('amount is immutable', t.fails(t.try(null,'service_role','update public.payment_transactions set amount_minor = 1 where provider_reference = ''r1''')));
  perform t.check('custody modes are refused while protected payments are off', t.fails(t.try(null,'service_role','update public.payment_transactions set custody_mode = ''platform_held'' where provider_reference = ''r1''')));
  perform t.check('payouts (settlement) are refused while disabled', t.fails(t.try(null,'service_role', format('insert into public.payouts(professional_id,amount_minor) values (%L,1000)', pidp1))));
  perform t.try(null,'service_role','update public.platform_settings set value = jsonb_set(value, ''{protected_payments_enabled}'', ''true'') where key = ''features''');
  perform t.check('payouts only become possible once the flag is enabled', t.try(null,'service_role', format('insert into public.payouts(professional_id,amount_minor) values (%L,1000)', pidp1)) = 'ok');
  perform t.try(null,'service_role','update public.platform_settings set value = jsonb_set(value, ''{protected_payments_enabled}'', ''false'') where key = ''features''');
  perform t.check('flag restored to disabled', not public.protected_payments_enabled());
end $$;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
select label as failed_check from t.results where not ok;
do $$ begin if exists (select 1 from t.results where not ok) then raise exception 'database tests failed'; end if; end $$;
