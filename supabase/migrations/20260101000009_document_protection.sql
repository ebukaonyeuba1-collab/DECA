-- DECA Stage 1 refinement | 0009 | verification evidence protection
-- Goals: owners upload and view; nothing is freely modified or deleted after submission; only administrators
-- decide reviews; database rows and storage files cannot drift apart through unauthorised deletion.

alter table public.professional_documents add column uploaded_at timestamptz;   -- set only by confirm_document_upload()

-- Documents may be soft-removed by their owner only while the application is still editable.
create or replace function public.document_edit_window_open(p_professional uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status in ('not_started','incomplete','additional_information_required')
                     from public.verification_applications where professional_id = p_professional), true) $$;

create or replace function public.guard_document_write() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if public.is_service_role() then return old; end if;   -- retention or erasure jobs run server-side, deliberately
    raise exception 'verification documents are retained as evidence and cannot be deleted';
  end if;
  if tg_op = 'INSERT' then
    if not public.is_privileged() then new.uploaded_at := null; new.deleted_at := null; end if;
    return new;
  end if;
  -- UPDATE
  if not public.is_service_role() then
    if new.professional_id is distinct from old.professional_id or new.requirement_id is distinct from old.requirement_id
       or new.storage_path is distinct from old.storage_path or new.file_name is distinct from old.file_name
       or new.mime_type is distinct from old.mime_type or new.size_bytes is distinct from old.size_bytes
       or new.created_at is distinct from old.created_at
       or (old.application_id is not null and new.application_id is distinct from old.application_id) then
      raise exception 'document files and identifiers are immutable; upload a new document instead';
    end if;
  end if;
  if not public.is_privileged() then
    if new.uploaded_at is distinct from old.uploaded_at or new.application_id is distinct from old.application_id then
      raise exception 'upload status is controlled by DECA';
    end if;
    if new.deleted_at is distinct from old.deleted_at then
      if old.deleted_at is not null or new.deleted_at is null then raise exception 'a removed document cannot be restored or changed'; end if;
      if not public.document_edit_window_open(old.professional_id) then
        raise exception 'documents are locked while verification is submitted, under review or decided'; end if;
      if old.review_status = 'accepted' then raise exception 'accepted documents cannot be removed'; end if;
    end if;
  elsif new.deleted_at is distinct from old.deleted_at and not public.is_service_role()
        and coalesce(current_setting('deca.internal', true), '') <> '1' then
    raise exception 'administrators cannot remove evidence';
  end if;
  return new;
end $$;
create trigger doc_guard before insert or update or delete on public.professional_documents
  for each row execute function public.guard_document_write();

create or replace function public.block_mutation_unless_service() returns trigger language plpgsql as $$
begin
  if public.is_service_role() then return coalesce(old, new); end if;
  raise exception '% is append-only', tg_table_name;
end $$;
create trigger vevents_append_only before update or delete on public.verification_events
  for each row execute function public.block_mutation_unless_service();

-- Policies: owners select, insert, and (guarded) soft-remove. Admins select and decide. Nobody deletes.
drop policy docs_owner on public.professional_documents;
drop policy docs_admin on public.professional_documents;
create policy docs_owner_select on public.professional_documents for select using (public.owns_professional(professional_id));
create policy docs_owner_insert on public.professional_documents for insert with check (public.owns_professional(professional_id));
create policy docs_owner_update on public.professional_documents for update using (public.owns_professional(professional_id)) with check (public.owns_professional(professional_id));
create policy docs_admin_select on public.professional_documents for select using (public.is_admin());
create policy docs_admin_update on public.professional_documents for update using (public.is_admin()) with check (public.is_admin());
drop policy vevents_admin on public.verification_events;
create policy vevents_admin_read on public.verification_events for select using (public.is_admin());
create policy vevents_admin_insert on public.verification_events for insert with check (public.is_admin());
drop policy vapp_admin on public.verification_applications;
create policy vapp_admin_read on public.verification_applications for select using (public.is_admin());
create policy vapp_admin_update on public.verification_applications for update using (public.is_admin()) with check (public.is_admin());
revoke delete on public.professional_documents, public.verification_applications, public.verification_events from authenticated;

-- ---------- storage: files only against a pending record, never deleted or overwritten by clients ----------
create or replace function public.document_upload_allowed(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.professional_documents d join public.professional_profiles p on p.id = d.professional_id
                  where d.storage_path = p_path and p.user_id = auth.uid() and d.deleted_at is null and d.uploaded_at is null) $$;

drop policy "verification docs: owner insert" on storage.objects;
drop policy "verification docs: owner delete" on storage.objects;
create policy "verification docs: insert only against a pending record" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-documents' and public.document_upload_allowed(name));
-- No update (blocks upsert/overwrite) and no delete policy exists for this bucket: clients cannot alter evidence files.
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','application/pdf']
 where id = 'verification-documents';

-- ---------- workflow functions ----------
create or replace function public.confirm_document_upload(p_document uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d public.professional_documents;
begin
  select * into d from public.professional_documents where id = p_document;
  if d.id is null or not public.owns_professional(d.professional_id) or d.deleted_at is not null then raise exception 'document not found'; end if;
  if d.uploaded_at is not null then return; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'verification-documents' and o.name = d.storage_path) then
    raise exception 'the file has not reached storage yet';
  end if;
  perform public.internal_flag_on();
  update public.professional_documents set uploaded_at = now() where id = p_document;
end $$;

create or replace function public.review_document(p_document uuid, p_status public.document_review_status, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d public.professional_documents; aid uuid;
begin
  if not public.is_admin() then raise exception 'administrator only'; end if;
  if p_status = 'rejected' and coalesce(trim(p_note), '') = '' then raise exception 'a reason is required'; end if;
  select * into d from public.professional_documents where id = p_document for update;
  if d.id is null or d.deleted_at is not null then raise exception 'document not found'; end if;
  if d.uploaded_at is null then raise exception 'the file has not been uploaded'; end if;
  perform public.internal_flag_on();
  update public.professional_documents set review_status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = p_document;
  select id into aid from public.verification_applications where professional_id = d.professional_id;
  if aid is not null then
    insert into public.verification_events(application_id, actor_id, event_type, message)
      values (aid, auth.uid(), 'document_' || p_status::text, coalesce(p_note, d.file_name));
  end if;
end $$;

create or replace function public.submit_verification_application() returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; aid uuid; st public.verification_status; missing int;
begin
  select id into pid from public.professional_profiles where user_id = auth.uid() and deleted_at is null;
  if pid is null then raise exception 'professional profile required'; end if;
  insert into public.verification_applications(professional_id) values (pid) on conflict (professional_id) do nothing;
  select id, status into aid, st from public.verification_applications where professional_id = pid;
  if st not in ('not_started','incomplete','additional_information_required') then
    raise exception 'application cannot be submitted from status %', st; end if;
  select count(*) into missing from public.required_documents_for(pid) r
   where not exists (select 1 from public.professional_documents d
                      where d.professional_id = pid and d.requirement_id = r.id and d.deleted_at is null
                        and d.uploaded_at is not null and d.review_status <> 'rejected');
  if missing > 0 then raise exception '% required document(s) still missing or not uploaded', missing; end if;
  perform public.internal_flag_on();
  update public.professional_documents set application_id = aid where professional_id = pid and application_id is null and deleted_at is null;
  update public.verification_applications set status = 'submitted', submitted_at = now() where id = aid;
  insert into public.verification_events(application_id, actor_id, event_type, from_status, to_status)
    values (aid, auth.uid(), 'submitted', st, 'submitted');
  return aid;
end $$;

-- Approval now requires every required document to be individually accepted by an administrator:
-- badges are never granted automatically.
create or replace function public.review_verification(p_application uuid, p_decision public.verification_status, p_reason text default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_status public.verification_status; pid uuid; unaccepted int;
begin
  if not public.is_admin() then raise exception 'administrator only'; end if;
  if p_decision not in ('under_review','additional_information_required','approved','rejected','suspended') then
    raise exception 'invalid decision %', p_decision; end if;
  if p_decision in ('additional_information_required','rejected') and coalesce(trim(p_reason),'') = '' then
    raise exception 'a reason is required'; end if;
  select status, professional_id into old_status, pid from public.verification_applications where id = p_application for update;
  if old_status is null then raise exception 'application not found'; end if;
  if p_decision = 'approved' then
    select count(*) into unaccepted from public.required_documents_for(pid) r
     where not exists (select 1 from public.professional_documents d
                        where d.professional_id = pid and d.requirement_id = r.id and d.deleted_at is null and d.review_status = 'accepted');
    if unaccepted > 0 then raise exception '% required document(s) have not been accepted', unaccepted; end if;
  end if;
  perform public.internal_flag_on();
  update public.verification_applications
     set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
         decision_reason = coalesce(p_reason, decision_reason), internal_notes = coalesce(p_notes, internal_notes)
   where id = p_application;
  insert into public.verification_events(application_id, actor_id, event_type, from_status, to_status, message)
    values (p_application, auth.uid(), 'admin_decision', old_status, p_decision, p_reason);
end $$;

-- Admin tool: detects rows and files that no longer match (run from the dashboard in Stage 8).
create or replace function public.reconcile_verification_files() returns table(issue text, document_id uuid, path text)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_service_role()) then raise exception 'administrator only'; end if;
  return query
    select 'record_without_file'::text, d.id, d.storage_path from public.professional_documents d
     where d.uploaded_at is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'verification-documents' and o.name = d.storage_path)
    union all
    select 'file_without_record', null::uuid, o.name from storage.objects o
     where o.bucket_id = 'verification-documents' and not exists (select 1 from public.professional_documents d where d.storage_path = o.name)
    union all
    select 'upload_not_confirmed', d.id, d.storage_path from public.professional_documents d
     where d.uploaded_at is null and d.deleted_at is null and d.created_at < now() - interval '1 hour'
       and exists (select 1 from storage.objects o where o.bucket_id = 'verification-documents' and o.name = d.storage_path);
end $$;

do $$ declare f text; begin
  foreach f in array array['confirm_document_upload(uuid)','review_document(uuid,public.document_review_status,text)','reconcile_verification_files()']
  loop execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated, service_role', f); end loop;
end $$;
