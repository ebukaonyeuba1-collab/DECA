-- DECA Stage 1 | 0006 | booking state machine and marketplace RPCs

-- Allowed transitions are DATA: change policy by editing rows, not code.
insert into public.booking_transitions(from_status, to_status, actor) values
 ('pending','quotation_requested','customer'),
 ('pending','cancelled','customer'),('pending','cancelled','admin'),
 ('quotation_requested','quotation_sent','professional'),
 ('quotation_requested','cancelled','customer'),('quotation_requested','cancelled','professional'),('quotation_requested','cancelled','admin'),
 ('quotation_sent','awaiting_approval','system'),
 ('awaiting_approval','confirmed','customer'),
 ('awaiting_approval','quotation_requested','customer'),
 ('awaiting_approval','cancelled','customer'),('awaiting_approval','cancelled','professional'),('awaiting_approval','cancelled','admin'),
 ('confirmed','awaiting_payment','system'),('confirmed','awaiting_payment','professional'),
 ('confirmed','scheduled','professional'),('confirmed','scheduled','admin'),
 ('confirmed','cancelled','customer'),('confirmed','cancelled','professional'),('confirmed','cancelled','admin'),
 ('awaiting_payment','payment_secured','system'),
 ('awaiting_payment','cancelled','customer'),('awaiting_payment','cancelled','admin'),('awaiting_payment','cancelled','system'),
 ('payment_secured','scheduled','professional'),('payment_secured','in_progress','professional'),
 ('payment_secured','disputed','customer'),('payment_secured','refunded','admin'),('payment_secured','refunded','system'),
 ('scheduled','in_progress','professional'),
 ('scheduled','cancelled','customer'),('scheduled','cancelled','professional'),('scheduled','cancelled','admin'),
 ('scheduled','disputed','customer'),
 ('in_progress','awaiting_customer_confirmation','professional'),
 ('in_progress','disputed','customer'),('in_progress','disputed','admin'),('in_progress','cancelled','admin'),
 ('awaiting_customer_confirmation','completed','customer'),('awaiting_customer_confirmation','completed','admin'),
 ('awaiting_customer_confirmation','in_progress','customer'),('awaiting_customer_confirmation','disputed','customer'),
 ('completed','disputed','customer'),('completed','disputed','admin'),
 ('disputed','completed','admin'),('disputed','in_progress','admin'),('disputed','cancelled','admin'),
 ('disputed','refunded','admin'),('disputed','refunded','system'),
 ('cancelled','refunded','admin'),('cancelled','refunded','system');

-- Internal: not callable by clients.
create or replace function public._apply_booking_transition(p_booking uuid, p_to public.booking_status, p_actor public.booking_actor, p_actor_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if not exists (select 1 from public.booking_transitions where from_status = b.status and to_status = p_to and actor = p_actor) then
    raise exception 'transition % to % is not allowed for %', b.status, p_to, p_actor;
  end if;
  perform public.internal_flag_on();
  update public.bookings set status = p_to,
      completed_at = case when p_to = 'completed' then now() else completed_at end,
      cancelled_by = case when p_to = 'cancelled' then p_actor else cancelled_by end,
      cancel_reason = case when p_to = 'cancelled' then p_note else cancel_reason end
   where id = p_booking;
  insert into public.booking_events(booking_id, actor_id, actor_role, from_status, to_status, note)
    values (p_booking, p_actor_id, p_actor, b.status, p_to, p_note);
end $$;
revoke all on function public._apply_booking_transition(uuid, public.booking_status, public.booking_actor, uuid, text) from public, anon, authenticated;

create or replace function public.transition_booking(p_booking uuid, p_to public.booking_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings; a public.booking_actor;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null then raise exception 'booking not found'; end if;
  if public.is_service_role() then a := 'system';
  elsif public.is_admin() then a := 'admin';
  elsif b.customer_id = auth.uid() then a := 'customer';
  elsif public.owns_professional(b.professional_id) then a := 'professional';
  else raise exception 'not a participant in this booking'; end if;
  perform public._apply_booking_transition(p_booking, p_to, a, auth.uid(), p_note);
end $$;

create or replace function public.request_quotation(p_professional uuid, p_service uuid, p_title text, p_description text,
  p_location uuid default null, p_address text default null, p_preferred_start timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; bid uuid;
begin
  if public.current_user_role() is distinct from 'customer' then raise exception 'customer account required'; end if;
  if not public.is_pro_public(p_professional) then raise exception 'professional is not available'; end if;
  if p_service is not null and not exists (select 1 from public.professional_services where id = p_service and professional_id = p_professional and is_active and deleted_at is null) then
    raise exception 'service does not belong to this professional'; end if;
  insert into public.conversations(customer_id, professional_id) values (auth.uid(), p_professional)
    on conflict (customer_id, professional_id) do update set last_message_at = now() returning id into cid;
  insert into public.bookings(customer_id, professional_id, service_id, conversation_id, status, title, description, location_id, address_text, scheduled_start)
    values (auth.uid(), p_professional, p_service, cid, 'quotation_requested', p_title, p_description, p_location, p_address, p_preferred_start)
    returning id into bid;
  insert into public.booking_events(booking_id, actor_id, actor_role, from_status, to_status)
    values (bid, auth.uid(), 'customer', null, 'quotation_requested');
  return bid;
end $$;

create or replace function public.send_quotation(p_quotation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare q public.quotations; days int;
begin
  select * into q from public.quotations where id = p_quotation for update;
  if q.id is null or not public.owns_professional(q.professional_id) then raise exception 'quotation not found'; end if;
  if q.status <> 'draft' then raise exception 'only a draft can be sent'; end if;
  if q.total_minor <= 0 then raise exception 'quotation needs itemised amounts'; end if;
  select coalesce((value ->> 'quotation_validity_days')::int, 7) into days from public.platform_settings where key = 'booking_policies';
  perform public.internal_flag_on();
  update public.quotations set status = 'sent', sent_at = now(), valid_until = coalesce(valid_until, now() + make_interval(days => coalesce(days, 7))) where id = p_quotation;
  perform public._apply_booking_transition(q.booking_id, 'quotation_sent', 'professional', auth.uid(), q.number);
  perform public._apply_booking_transition(q.booking_id, 'awaiting_approval', 'system', null, null);
end $$;

create or replace function public.approve_quotation(p_quotation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare q public.quotations; snap jsonb;
begin
  select * into q from public.quotations where id = p_quotation for update;
  if q.id is null or q.customer_id <> auth.uid() then raise exception 'quotation not found'; end if;
  if q.status <> 'sent' then raise exception 'quotation is not awaiting approval'; end if;
  if q.valid_until is not null and q.valid_until < now() then raise exception 'quotation has expired'; end if;
  snap := jsonb_build_object('quotation', to_jsonb(q),
          'items', coalesce((select jsonb_agg(to_jsonb(i)) from public.quotation_items i where i.quotation_id = q.id), '[]'::jsonb));
  perform public.internal_flag_on();
  update public.quotations set status = 'accepted', responded_at = now() where id = q.id;
  update public.quotations set status = 'withdrawn' where booking_id = q.booking_id and id <> q.id and status in ('draft','sent');
  update public.bookings set quotation_id = q.id, agreed_amount_minor = q.total_minor, currency = q.currency,
         agreed_snapshot = snap, scheduled_start = coalesce(q.proposed_start, scheduled_start) where id = q.booking_id;
  perform public._apply_booking_transition(q.booking_id, 'confirmed', 'customer', auth.uid(), q.number);
end $$;

create or replace function public.reject_quotation(p_quotation uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare q public.quotations;
begin
  select * into q from public.quotations where id = p_quotation for update;
  if q.id is null or q.customer_id <> auth.uid() then raise exception 'quotation not found'; end if;
  if q.status <> 'sent' then raise exception 'quotation is not awaiting a response'; end if;
  perform public.internal_flag_on();
  update public.quotations set status = 'rejected', responded_at = now() where id = q.id;
  perform public._apply_booking_transition(q.booking_id, 'quotation_requested', 'customer', auth.uid(), p_reason);
end $$;

create or replace function public.raise_dispute(p_booking uuid, p_reason text, p_description text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare b public.bookings; did uuid; a public.booking_actor;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null or not public.is_booking_participant(p_booking) then raise exception 'booking not found'; end if;
  a := case when b.customer_id = auth.uid() then 'customer' else 'professional' end;
  insert into public.disputes(booking_id, raised_by, customer_id, professional_id, reason, description)
    values (b.id, auth.uid(), b.customer_id, b.professional_id, p_reason, p_description) returning id into did;
  if a = 'customer' and b.status <> 'disputed' then
    perform public._apply_booking_transition(b.id, 'disputed', 'customer', auth.uid(), p_reason);
  end if;
  return did;
end $$;

do $$ declare f text; begin
  foreach f in array array['transition_booking(uuid,public.booking_status,text)','request_quotation(uuid,uuid,text,text,uuid,text,timestamptz)',
    'send_quotation(uuid)','approve_quotation(uuid)','reject_quotation(uuid,text)','raise_dispute(uuid,text,text)',
    'submit_verification_application()','review_verification(uuid,public.verification_status,text,text)','required_documents_for(uuid)']
  loop execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated, service_role', f); end loop;
end $$;

-- Reference configuration (values are editable by administrators; nothing is hardcoded in app code).
insert into public.platform_settings(key, value, description, is_public) values
 ('commission', '{"default_bps": null, "by_category": {}}', 'Commission in basis points. null means not yet configured; no commission is recorded.', false),
 ('customer_fee', '{"default_bps": null}', 'Optional customer service fee in basis points.', false),
 ('supported_currencies', '["NGN"]', 'ISO currency codes shown to users.', true),
 ('booking_policies', '{"quotation_validity_days": 7}', 'Booking and quotation policy values.', false),
 ('features', '{"protected_payments_enabled": false, "subscriptions_enabled": false, "sms_otp_enabled": false, "identity_provider": "manual"}', 'Feature gates. Protected payments stay off until a partner and legal structure are confirmed.', true);

insert into public.subscription_plans(tier, name, price_minor, is_active, features) values
 ('free', 'Free', 0, true, '{"profile": true, "discovery": true, "enquiries": true}'),
 ('professional', 'Professional', null, false, '{"analytics": true}'),
 ('business', 'Business', null, false, '{"analytics": true, "team": true}');
