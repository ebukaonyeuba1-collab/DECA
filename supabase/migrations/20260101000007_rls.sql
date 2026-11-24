-- DECA Stage 1 | 0007 | Row Level Security. Default deny: every public table is locked, then opened deliberately.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ===== reference data: readable by everyone, writable by admins =====
create policy locations_read on public.locations for select using (is_active or public.is_admin());
create policy locations_admin on public.locations for all using (public.is_admin()) with check (public.is_admin());
create policy categories_read on public.service_categories for select using (is_active or public.is_admin());
create policy categories_admin on public.service_categories for all using (public.is_admin()) with check (public.is_admin());
create policy subcategories_read on public.service_subcategories for select using (is_active or public.is_admin());
create policy subcategories_admin on public.service_subcategories for all using (public.is_admin()) with check (public.is_admin());
create policy requirements_read on public.verification_requirements for select to authenticated using (is_active or public.is_admin());
create policy requirements_admin on public.verification_requirements for all using (public.is_admin()) with check (public.is_admin());
create policy plans_read on public.subscription_plans for select using (is_active or public.is_admin());
create policy plans_admin on public.subscription_plans for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy settings_read on public.platform_settings for select using (is_public or public.is_admin());
create policy settings_write on public.platform_settings for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy transitions_read on public.booking_transitions for select to authenticated using (true);
create policy transitions_admin on public.booking_transitions for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ===== accounts =====
create policy profiles_self on public.profiles for select using (id = auth.uid() or public.is_admin() or public.shares_conversation_with(id));
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy customer_self on public.customer_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy customer_admin on public.customer_profiles for select using (public.is_admin());
create policy addresses_self on public.user_addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_admin on public.user_addresses for select using (public.is_admin());

-- ===== professionals: public only when approved AND listed =====
create policy pro_public on public.professional_profiles for select using (is_listed and verification_status = 'approved' and deleted_at is null);
create policy pro_owner_read on public.professional_profiles for select using (user_id = auth.uid());
create policy pro_owner_insert on public.professional_profiles for insert with check (user_id = auth.uid() and public.current_user_role() = 'professional');
create policy pro_owner_update on public.professional_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pro_admin on public.professional_profiles for all using (public.is_admin()) with check (public.is_admin());

create policy business_owner on public.businesses for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy business_public on public.businesses for select using (exists (select 1 from public.professional_profiles p where p.business_id = businesses.id and public.is_pro_public(p.id)));
create policy business_admin on public.businesses for select using (public.is_admin());

-- child tables of a professional: public if the professional is public, full control for the owner
do $$ declare t text; begin
  foreach t in array array['professional_services','service_locations','professional_availability','availability_exceptions','portfolio_items']
  loop
    execute format('create policy %1$s_public on public.%1$I for select using (public.is_pro_public(professional_id))', t);
    execute format('create policy %1$s_owner on public.%1$I for all using (public.owns_professional(professional_id)) with check (public.owns_professional(professional_id))', t);
    execute format('create policy %1$s_admin on public.%1$I for select using (public.is_admin())', t);
  end loop;
end $$;
create policy portfolio_media_public on public.portfolio_media for select using (exists (select 1 from public.portfolio_items i where i.id = portfolio_item_id and public.is_pro_public(i.professional_id)));
create policy portfolio_media_owner on public.portfolio_media for all
  using (exists (select 1 from public.portfolio_items i where i.id = portfolio_item_id and public.owns_professional(i.professional_id)))
  with check (exists (select 1 from public.portfolio_items i where i.id = portfolio_item_id and public.owns_professional(i.professional_id)));
create policy portfolio_media_admin on public.portfolio_media for select using (public.is_admin());

-- ===== verification: private to the owner and administrators, never public =====
create policy vapp_owner_read on public.verification_applications for select using (public.owns_professional(professional_id));
create policy vapp_owner_write on public.verification_applications for insert with check (public.owns_professional(professional_id));
create policy vapp_owner_update on public.verification_applications for update using (public.owns_professional(professional_id)) with check (public.owns_professional(professional_id));
create policy vapp_admin on public.verification_applications for all using (public.is_admin()) with check (public.is_admin());
create policy docs_owner on public.professional_documents for all using (public.owns_professional(professional_id)) with check (public.owns_professional(professional_id));
create policy docs_admin on public.professional_documents for all using (public.is_admin()) with check (public.is_admin());
create policy vevents_owner on public.verification_events for select using (visible_to_professional and exists
  (select 1 from public.verification_applications a where a.id = application_id and public.owns_professional(a.professional_id)));
create policy vevents_admin on public.verification_events for all using (public.is_admin()) with check (public.is_admin());

-- ===== messaging: participants and admins only =====
create policy conv_read on public.conversations for select using (public.is_conversation_participant(id) or public.is_admin());
create policy conv_block on public.conversations for update using (public.is_conversation_participant(id)) with check (public.is_conversation_participant(id));
create policy cp_read on public.conversation_participants for select using (public.is_conversation_participant(conversation_id) or public.is_admin());
create policy cp_update_own on public.conversation_participants for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy msg_read on public.messages for select using (public.is_conversation_participant(conversation_id) or public.is_admin());
create policy msg_insert on public.messages for insert with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id)
  and exists (select 1 from public.conversations c where c.id = conversation_id and c.blocked_by is null));
create policy att_read on public.message_attachments for select using (exists (select 1 from public.messages m where m.id = message_id and (public.is_conversation_participant(m.conversation_id) or public.is_admin())));
create policy att_insert on public.message_attachments for insert with check (exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()));
create policy saved_self on public.saved_professionals for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- ===== bookings and quotations: reads for participants; writes go through RPCs =====
create policy bookings_read on public.bookings for select using (customer_id = auth.uid() or public.owns_professional(professional_id) or public.is_admin());
create policy bevents_read on public.booking_events for select using (public.is_booking_participant(booking_id) or public.is_admin());
create policy jobupd_read on public.job_updates for select using (public.is_booking_participant(booking_id) or public.is_admin());
create policy jobupd_insert on public.job_updates for insert with check (author_id = auth.uid() and exists
  (select 1 from public.bookings b where b.id = booking_id and public.owns_professional(b.professional_id) and b.status in ('scheduled','in_progress','awaiting_customer_confirmation')));
create policy changereq_read on public.booking_change_requests for select using (public.is_booking_participant(booking_id) or public.is_admin());
create policy changereq_insert on public.booking_change_requests for insert with check (requested_by = auth.uid() and public.is_booking_participant(booking_id));

create policy quote_read on public.quotations for select using (customer_id = auth.uid() or public.owns_professional(professional_id) or public.is_admin());
create policy quote_insert on public.quotations for insert with check (status = 'draft' and public.owns_professional(professional_id) and exists
  (select 1 from public.bookings b where b.id = booking_id and b.professional_id = professional_id and b.customer_id = quotations.customer_id and b.status = 'quotation_requested'));
create policy quote_update on public.quotations for update using (public.owns_professional(professional_id) and status = 'draft') with check (public.owns_professional(professional_id) and status = 'draft');
create policy qitems_read on public.quotation_items for select using (exists (select 1 from public.quotations q where q.id = quotation_id and (q.customer_id = auth.uid() or public.owns_professional(q.professional_id) or public.is_admin())));
create policy qitems_write on public.quotation_items for all using (exists (select 1 from public.quotations q where q.id = quotation_id and public.owns_professional(q.professional_id)))
  with check (exists (select 1 from public.quotations q where q.id = quotation_id and public.owns_professional(q.professional_id)));
create policy qrev_read on public.quotation_revisions for select using (exists (select 1 from public.quotations q where q.id = quotation_id and (q.customer_id = auth.uid() or public.owns_professional(q.professional_id) or public.is_admin())));

-- ===== reviews =====
create policy reviews_public on public.reviews for select using (status = 'published' or customer_id = auth.uid() or public.owns_professional(professional_id) or public.is_admin());
create policy reviews_insert on public.reviews for insert with check (customer_id = auth.uid());
create policy reviews_admin on public.reviews for update using (public.is_admin()) with check (public.is_admin());
create policy rresp_public on public.review_responses for select using (true);
create policy rresp_insert on public.review_responses for insert with check (public.owns_professional(professional_id) and exists (select 1 from public.reviews r where r.id = review_id and r.professional_id = review_responses.professional_id));
create policy rreports_insert on public.review_reports for insert with check (reporter_id = auth.uid());
create policy rreports_admin on public.review_reports for all using (public.is_admin()) with check (public.is_admin());

-- ===== disputes =====
create policy disputes_read on public.disputes for select using (customer_id = auth.uid() or public.owns_professional(professional_id) or public.is_admin());
create policy disputes_admin on public.disputes for update using (public.is_admin()) with check (public.is_admin());
create policy devidence_read on public.dispute_evidence for select using (public.is_dispute_participant(dispute_id) or public.is_admin());
create policy devidence_insert on public.dispute_evidence for insert with check (uploaded_by = auth.uid() and (public.is_dispute_participant(dispute_id) or public.is_admin()));

create policy notif_self on public.notifications for select using (user_id = auth.uid());
create policy notif_read on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== money: read-only for the parties; all writes come from the server (service role) =====
create policy paytx_read on public.payment_transactions for select using (customer_id = auth.uid() or public.owns_professional(professional_id) or public.is_admin());
create policy payev_admin on public.payment_events for select using (public.is_admin());
create policy ledger_admin on public.ledger_entries for select using (public.is_admin());
create policy commissions_read on public.commissions for select using (public.is_admin() or exists (select 1 from public.bookings b where b.id = booking_id and public.owns_professional(b.professional_id)));
create policy payout_acct_owner on public.payout_accounts for all using (public.owns_professional(professional_id)) with check (public.owns_professional(professional_id));
create policy payout_acct_admin on public.payout_accounts for select using (public.is_admin());
create policy payouts_read on public.payouts for select using (public.owns_professional(professional_id) or public.is_admin());
create policy refunds_read on public.refunds for select using (public.is_admin() or public.is_booking_participant(booking_id));
create policy subs_read on public.subscriptions for select using (public.owns_professional(professional_id) or public.is_admin());
create policy audit_read on public.admin_audit_logs for select using (public.is_admin());

-- Table privileges: anon may only read public reference and discovery data (still filtered by the policies above).
revoke all on all tables in schema public from anon;
grant select on public.locations, public.service_categories, public.service_subcategories, public.professional_profiles,
  public.professional_services, public.service_locations, public.professional_availability, public.availability_exceptions,
  public.portfolio_items, public.portfolio_media, public.reviews, public.review_responses, public.businesses,
  public.subscription_plans, public.platform_settings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- Authenticated users never receive direct write access to money tables, logs or workflow tables:
revoke insert, update, delete on public.payment_transactions, public.payment_events, public.ledger_entries, public.commissions,
  public.payouts, public.refunds, public.admin_audit_logs, public.booking_events, public.bookings, public.booking_transitions,
  public.subscriptions, public.conversations, public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
grant update (blocked_by, reported_at) on public.conversations to authenticated;
revoke all on function public.internal_flag_on() from public, anon, authenticated;
