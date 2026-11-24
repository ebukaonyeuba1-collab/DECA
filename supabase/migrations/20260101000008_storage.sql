-- DECA Stage 1 | 0008 | storage buckets and policies
-- Paths: public-media/{user_id}/..  verification-documents/{user_id}/..
--        message-attachments/{conversation_id}/{user_id}/..  dispute-evidence/{dispute_id}/{user_id}/..
insert into storage.buckets(id, name, public) values
 ('public-media','public-media', true),
 ('verification-documents','verification-documents', false),
 ('message-attachments','message-attachments', false),
 ('dispute-evidence','dispute-evidence', false)
on conflict (id) do nothing;

create policy "public media: read" on storage.objects for select using (bucket_id = 'public-media');
create policy "public media: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public media: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public media: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "verification docs: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "verification docs: owner or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'verification-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "verification docs: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "message files: participant read" on storage.objects for select to authenticated
  using (bucket_id = 'message-attachments' and (public.is_admin() or public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1]))));
create policy "message files: participant insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-attachments' and (storage.foldername(name))[2] = auth.uid()::text
              and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));

create policy "dispute files: participant read" on storage.objects for select to authenticated
  using (bucket_id = 'dispute-evidence' and (public.is_admin() or public.is_dispute_participant(public.try_uuid((storage.foldername(name))[1]))));
create policy "dispute files: participant insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'dispute-evidence' and (storage.foldername(name))[2] = auth.uid()::text
              and public.is_dispute_participant(public.try_uuid((storage.foldername(name))[1])));
