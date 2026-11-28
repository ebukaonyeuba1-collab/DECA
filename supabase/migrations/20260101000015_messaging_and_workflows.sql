-- DECA Stages 4-6 | 0015 | notifications, messaging helpers, job evidence, change requests, customer notes
-- Reuses the Stage 1 tables (conversations, messages, bookings, job_updates, booking_change_requests, notifications).

alter table public.bookings add column approved_changes_minor bigint not null default 0;   -- approved change requests; the original agreed amount stays immutable

-- ---------- notification helpers (internal) ----------
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text default null, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, data) select p_user, p_type, p_title, p_body, p_data where p_user is not null $$;
create or replace function public.notify_admins(p_type text, p_title text, p_body text default null, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, data)
  select id, p_type, p_title, p_body, p_data from public.profiles where role in ('admin','super_admin') and status = 'active' $$;
revoke all on function public.notify(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.notify_admins(text,text,text,jsonb) from public, anon, authenticated;

create or replace function public.notify_booking_event() returns trigger language plpgsql security definer set search_path = public as $$
declare b public.bookings; pro_user uuid; cust uuid; actor uuid := new.actor_id; d jsonb;
begin
  select * into b from public.bookings where id = new.booking_id;
  select user_id into pro_user from public.professional_profiles where id = b.professional_id;
  cust := b.customer_id; d := jsonb_build_object('booking_id', b.id, 'reference', b.reference);
  case new.to_status
    when 'quotation_requested' then
      if new.from_status is null then perform public.notify(pro_user, 'enquiry', 'New enquiry', b.title, d);
      else perform public.notify(pro_user, 'enquiry', 'Quotation sent back for changes', b.title, d); end if;
    when 'awaiting_approval' then perform public.notify(cust, 'quotation', 'Quotation received', b.title, d);
    when 'confirmed' then perform public.notify(pro_user, 'booking', 'Quotation approved: booking confirmed', b.title, d);
    when 'awaiting_payment' then perform public.notify(cust, 'payment', 'Payment needed to confirm your booking', b.title, d);
    when 'payment_secured' then perform public.notify(pro_user, 'payment', 'Payment received', b.title, d); perform public.notify(cust, 'payment', 'Payment received', b.title, d);
    when 'scheduled' then perform public.notify(cust, 'booking', 'Your booking is scheduled', b.title, d);
    when 'in_progress' then perform public.notify(cust, 'booking', 'Work has started', b.title, d);
    when 'awaiting_customer_confirmation' then perform public.notify(cust, 'booking', 'Please confirm the job is complete', b.title, d);
    when 'completed' then perform public.notify(pro_user, 'booking', 'Job completed', b.title, d); perform public.notify(cust, 'booking', 'Job completed: leave a review', b.title, d);
    when 'cancelled' then
      if actor is distinct from cust then perform public.notify(cust, 'booking', 'Booking cancelled', b.title, d); end if;
      if actor is distinct from pro_user then perform public.notify(pro_user, 'booking', 'Booking cancelled', b.title, d); end if;
    when 'disputed' then perform public.notify(cust, 'dispute', 'A dispute was opened', b.title, d); perform public.notify(pro_user, 'dispute', 'A dispute was opened', b.title, d); perform public.notify_admins('dispute', 'Disputed booking', b.reference, d);
    when 'refunded' then perform public.notify(cust, 'payment', 'Your refund was processed', b.title, d);
    else null;
  end case;
  return null;
end $$;
create trigger booking_events_notify after insert on public.booking_events for each row execute function public.notify_booking_event();

create or replace function public.notify_new_message() returns trigger language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  select user_id into other from public.conversation_participants where conversation_id = new.conversation_id and user_id <> new.sender_id limit 1;
  if other is not null and not exists (select 1 from public.notifications where user_id = other and type = 'message' and read_at is null and data ->> 'conversation_id' = new.conversation_id::text) then
    perform public.notify(other, 'message', 'New message', left(new.body, 80), jsonb_build_object('conversation_id', new.conversation_id));
  end if;
  return null;
end $$;
create trigger messages_notify after insert on public.messages for each row execute function public.notify_new_message();

create or replace function public.notify_review() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.notify((select user_id from public.professional_profiles where id = new.professional_id), 'review', 'New review', null, jsonb_build_object('review_id', new.id)); return null; end $$;
create trigger reviews_notify after insert on public.reviews for each row execute function public.notify_review();

create or replace function public.notify_verification_event() returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if new.event_type in ('admin_decision','document_accepted','document_rejected') and new.visible_to_professional then
    select p.user_id into u from public.verification_applications a join public.professional_profiles p on p.id = a.professional_id where a.id = new.application_id;
    perform public.notify(u, 'verification', case new.event_type when 'admin_decision' then 'Verification update' else 'Document reviewed' end, new.message, jsonb_build_object('application_id', new.application_id));
  elsif new.event_type = 'submitted' then perform public.notify_admins('verification', 'New verification application', null, jsonb_build_object('application_id', new.application_id));
  end if;
  return null;
end $$;
create trigger verification_events_notify after insert on public.verification_events for each row execute function public.notify_verification_event();

-- ---------- messaging ----------
create or replace function public.start_conversation(p_professional uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if public.current_user_role() is distinct from 'customer' then raise exception 'customer account required'; end if;
  if not public.is_pro_public(p_professional) then raise exception 'professional is not available'; end if;
  insert into public.conversations(customer_id, professional_id) values (auth.uid(), p_professional)
    on conflict (customer_id, professional_id) do update set last_message_at = public.conversations.last_message_at returning id into cid;
  return cid;
end $$;

create or replace function public.my_conversations() returns table (id uuid, partner_name text, partner_avatar text, last_message text, last_message_at timestamptz, unread bigint, blocked boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
         coalesce(pp.display_name, nullif(split_part(trim(u.full_name), ' ', 1) || case when position(' ' in trim(u.full_name)) > 0 then ' ' || left(regexp_replace(trim(u.full_name), '^.*\s', ''), 1) || '.' else '' end, ''), 'DECA user'),
         u.avatar_path,
         (select left(m.body, 80) from public.messages m where m.conversation_id = c.id and m.deleted_at is null order by m.created_at desc limit 1),
         c.last_message_at,
         (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.deleted_at is null and (me.last_read_at is null or m.created_at > me.last_read_at)),
         c.blocked_by is not null
    from public.conversations c
    join public.conversation_participants me on me.conversation_id = c.id and me.user_id = auth.uid()
    join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> auth.uid()
    join public.profiles u on u.id = other.user_id
    left join public.professional_profiles pp on pp.user_id = u.id
   order by c.last_message_at desc $$;

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversation_participants set last_read_at = now() where conversation_id = p_conversation and user_id = auth.uid() $$;

create or replace function public.guard_conversation_block() returns trigger language plpgsql as $$
begin
  if not public.is_privileged() and new.blocked_by is distinct from old.blocked_by then
    if new.blocked_by is not null and new.blocked_by <> auth.uid() then raise exception 'you can only block as yourself'; end if;
    if new.blocked_by is null and old.blocked_by is distinct from auth.uid() then raise exception 'only the person who blocked can unblock'; end if;
  end if;
  return new;
end $$;
create trigger conversations_block_guard before update on public.conversations for each row execute function public.guard_conversation_block();

create or replace function public.report_conversation(p_conversation uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_conversation_participant(p_conversation) then raise exception 'conversation not found'; end if;
  update public.conversations set reported_at = now() where id = p_conversation;
  perform public.notify_admins('report', 'Conversation reported', left(coalesce(p_reason, ''), 200), jsonb_build_object('conversation_id', p_conversation));
end $$;

-- Abuse limits (per sender): bursts of messages are refused with a clear message.
create or replace function public.limit_messages() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too quickly. Please wait a moment.'; end if;
  return new;
end $$;
create trigger messages_limit before insert on public.messages for each row execute function public.limit_messages();

-- ---------- customer notes (private to the professional) ----------
create table public.customer_notes (
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(note) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (professional_id, customer_id)
);
alter table public.customer_notes enable row level security;
create policy notes_owner on public.customer_notes for all using (public.owns_professional(professional_id)) with check (public.owns_professional(professional_id));
revoke all on public.customer_notes from anon, authenticated;
grant select, insert, update, delete on public.customer_notes to authenticated;
create trigger set_updated_at before update on public.customer_notes for each row execute function public.set_updated_at();

-- ---------- job evidence ----------
insert into storage.buckets(id, name, public) values ('job-evidence', 'job-evidence', false) on conflict (id) do nothing;
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'job-evidence';
-- paths: {booking_id}/{user_id}/{file}
create policy "job files: participant read" on storage.objects for select to authenticated
  using (bucket_id = 'job-evidence' and (public.is_admin() or public.is_booking_participant(public.try_uuid((storage.foldername(name))[1]))));
create policy "job files: participant insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-evidence' and (storage.foldername(name))[2] = auth.uid()::text and public.is_booking_participant(public.try_uuid((storage.foldername(name))[1])));
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'] where id in ('message-attachments','dispute-evidence');

create or replace function public.submit_completion(p_booking uuid, p_message text, p_paths text[] default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; pth text;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null or not public.owns_professional(b.professional_id) then raise exception 'booking not found'; end if;
  if b.status <> 'in_progress' then raise exception 'the job must be in progress'; end if;
  if coalesce(trim(p_message), '') = '' and cardinality(coalesce(p_paths, '{}')) = 0 then raise exception 'add a note or photos as completion evidence'; end if;
  foreach pth in array coalesce(p_paths, '{}') loop
    if pth not like p_booking::text || '/' || auth.uid()::text || '/%' or pth like '%..%' then raise exception 'invalid evidence file'; end if;
  end loop;
  perform public.internal_flag_on();
  insert into public.job_updates(booking_id, author_id, message, media_paths, is_completion_evidence) values (p_booking, auth.uid(), left(p_message, 2000), coalesce(p_paths, '{}'), true);
  perform public._apply_booking_transition(p_booking, 'awaiting_customer_confirmation', 'professional', auth.uid(), 'completion evidence submitted');
end $$;

-- ---------- change requests: the agreed scope stays frozen; approved changes are recorded separately ----------
create or replace function public.request_change(p_booking uuid, p_description text, p_delta_minor bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare b public.bookings; cid uuid;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null or not public.is_booking_participant(p_booking) then raise exception 'booking not found'; end if;
  if b.status not in ('confirmed','awaiting_payment','scheduled','in_progress') then raise exception 'changes can only be requested before the work is finished'; end if;
  if coalesce(trim(p_description), '') = '' then raise exception 'describe the change'; end if;
  if coalesce(b.agreed_amount_minor, 0) + b.approved_changes_minor + p_delta_minor <= 0 then raise exception 'the new total must stay above zero'; end if;
  if p_delta_minor <> 0 and exists (select 1 from public.payment_transactions where booking_id = p_booking and status = 'succeeded') then raise exception 'changing the price after payment is not supported yet'; end if;
  insert into public.booking_change_requests(booking_id, requested_by, description, amount_delta_minor) values (p_booking, auth.uid(), left(p_description, 1000), p_delta_minor) returning id into cid;
  perform public.notify(case when b.customer_id = auth.uid() then (select user_id from public.professional_profiles where id = b.professional_id) else b.customer_id end, 'booking', 'Change requested', left(p_description, 80), jsonb_build_object('booking_id', b.id));
  return cid;
end $$;

create or replace function public.respond_change_request(p_request uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.booking_change_requests; b public.bookings;
begin
  select * into r from public.booking_change_requests where id = p_request for update;
  if r.id is null then raise exception 'request not found'; end if;
  select * into b from public.bookings where id = r.booking_id for update;
  if not public.is_booking_participant(b.id) or r.requested_by = auth.uid() then raise exception 'only the other party can respond'; end if;
  if r.status <> 'pending' then raise exception 'this request was already answered'; end if;
  if p_approve then
    if b.status not in ('confirmed','awaiting_payment','scheduled','in_progress') then raise exception 'changes can no longer be applied'; end if;
    if coalesce(b.agreed_amount_minor, 0) + b.approved_changes_minor + r.amount_delta_minor <= 0 then raise exception 'the new total must stay above zero'; end if;
    if r.amount_delta_minor <> 0 and exists (select 1 from public.payment_transactions where booking_id = b.id and status in ('initiated','pending','succeeded')) then raise exception 'the price cannot change once payment has started'; end if;
    perform public.internal_flag_on();
    update public.bookings set approved_changes_minor = approved_changes_minor + r.amount_delta_minor where id = b.id;
  end if;
  update public.booking_change_requests set status = case when p_approve then 'approved' else 'rejected' end, responded_at = now() where id = r.id;
end $$;

do $$ declare f text; begin
  foreach f in array array['start_conversation(uuid)','my_conversations()','mark_conversation_read(uuid)','report_conversation(uuid,text)','submit_completion(uuid,text,text[])','request_change(uuid,text,bigint)','respond_change_request(uuid,boolean)']
  loop execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated, service_role', f); end loop;
end $$;
