-- READ-ONLY checks for your REAL Supabase project. Paste into the Supabase SQL Editor and run.
-- Changes nothing. Every row should show ok = true. Anything false is a deployment problem to fix before real users.
select * from (
  select 'migrations applied: 14 files recorded' as check_name,
         (select count(*) from supabase_migrations.schema_migrations) >= 14 as ok
  union all select 'RLS enabled on every public table',
         not exists (select 1 from pg_tables t where t.schemaname = 'public' and not t.rowsecurity)
  union all select 'tables exist: policy_acceptances, professional_documents, verification_events',
         (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('policy_acceptances','professional_documents','verification_events')) = 3
  union all select 'anon cannot read private tables (profiles, professional_profiles, documents, businesses, payments)',
         not (has_table_privilege('anon','public.profiles','select') or has_table_privilege('anon','public.professional_profiles','select')
           or has_table_privilege('anon','public.professional_documents','select') or has_table_privilege('anon','public.businesses','select')
           or has_table_privilege('anon','public.payment_transactions','select'))
  union all select 'anon can read the public discovery views',
         has_table_privilege('anon','public.public_professionals','select') and has_table_privilege('anon','public.public_reviews','select')
  union all select 'authenticated cannot write money, ledger, bookings or audit tables directly',
         not (has_table_privilege('authenticated','public.payment_transactions','insert') or has_table_privilege('authenticated','public.ledger_entries','insert')
           or has_table_privilege('authenticated','public.bookings','insert') or has_table_privilege('authenticated','public.admin_audit_logs','insert')
           or has_table_privilege('authenticated','public.policy_acceptances','insert'))
  union all select 'authenticated cannot delete verification documents, applications or events',
         not (has_table_privilege('authenticated','public.professional_documents','delete') or has_table_privilege('authenticated','public.verification_applications','delete')
           or has_table_privilege('authenticated','public.verification_events','delete'))
  union all select 'admin and workflow functions are not callable by anon',
         not (has_function_privilege('anon','public.review_document(uuid,public.document_review_status,text)','execute')
           or has_function_privilege('anon','public.review_verification(uuid,public.verification_status,text,text)','execute')
           or has_function_privilege('anon','public.submit_verification_application()','execute')
           or has_function_privilege('anon','public.accept_policies(text[])','execute'))
  union all select 'internal helper functions are not callable by clients',
         not (has_function_privilege('authenticated','public.internal_flag_on()','execute') or has_function_privilege('authenticated','public._apply_booking_transition(uuid,public.booking_status,public.booking_actor,uuid,text)','execute'))
  union all select 'storage buckets exist with correct visibility',
         (select count(*) from storage.buckets where (id = 'public-media' and public) or (id in ('verification-documents','message-attachments','dispute-evidence') and not public)) = 4
  union all select 'verification bucket limited to 10 MB and jpeg/png/pdf',
         exists (select 1 from storage.buckets where id = 'verification-documents' and file_size_limit = 10485760 and allowed_mime_types @> array['application/pdf','image/jpeg','image/png'] and cardinality(allowed_mime_types) = 3)
  union all select 'public-media limited to 5 MB images',
         exists (select 1 from storage.buckets where id = 'public-media' and file_size_limit = 5242880 and cardinality(allowed_mime_types) = 3)
  union all select 'verification bucket has no update or delete policy for clients',
         not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'verification docs%' and cmd in ('UPDATE','DELETE'))
  union all select 'verification bucket insert is tied to a pending record',
         exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'verification docs: insert only against a pending record')
  union all select 'sign-up trigger installed on auth.users',
         exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass)
  union all select 'protected payments are OFF',
         not public.protected_payments_enabled()
  union all select 'reference data seeded (18 categories, 37+ locations, baseline requirements)',
         (select count(*) from public.service_categories) >= 18 and (select count(*) from public.locations) >= 38 and (select count(*) from public.verification_requirements where category_id is null) >= 2
  union all select 'policies configured with a version',
         public.current_policy_version() <> '0'
  union all select 'no demo professionals present (production only: expect true there, false on dev)',
         not exists (select 1 from public.professional_profiles where display_name like '[DEMO]%')
  union all select 'at least one admin or super_admin exists',
         exists (select 1 from public.profiles where role in ('admin','super_admin'))
) c order by ok, check_name;
