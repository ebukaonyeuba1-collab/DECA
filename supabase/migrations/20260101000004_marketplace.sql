-- DECA Stage 1 | 0004 | messaging, quotations, bookings, reviews, disputes, notifications

create sequence public.booking_ref_seq start 1000;
create sequence public.quotation_no_seq start 1000;
create sequence public.dispute_ref_seq start 1000;

-- ---------- access helpers ----------
create or replace function public.owns_professional(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.professional_profiles where id = pid and user_id = auth.uid()) $$;

create or replace function public.is_pro_public(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.professional_profiles p join public.profiles u on u.id = p.user_id
                  where p.id = pid and p.verification_status = 'approved' and p.is_listed
                    and p.deleted_at is null and u.status = 'active') $$;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  blocked_by uuid references public.profiles(id),
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  unique (customer_id, professional_id)
);
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index conv_participants_user_idx on public.conversation_participants(user_id);

create or replace function public.is_conversation_participant(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_participants where conversation_id = cid and user_id = auth.uid()) $$;

create or replace function public.shares_conversation_with(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_participants a join public.conversation_participants b
                  on a.conversation_id = b.conversation_id where a.user_id = auth.uid() and b.user_id = uid) $$;

create or replace function public.add_conversation_participants() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.conversation_participants(conversation_id, user_id) values (new.id, new.customer_id);
  insert into public.conversation_participants(conversation_id, user_id)
    select new.id, user_id from public.professional_profiles where id = new.professional_id;
  return new;
end $$;
create trigger conv_participants after insert on public.conversations
  for each row execute function public.add_conversation_participants();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null default '' check (char_length(body) <= 4000),
  kind text not null default 'text' check (kind in ('text','system')),
  booking_id uuid,
  quotation_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index messages_conv_idx on public.messages(conversation_id, created_at desc);
create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  size_bytes bigint
);
create or replace function public.touch_conversation() returns trigger language plpgsql security definer set search_path = public as $$
begin update public.conversations set last_message_at = new.created_at where id = new.conversation_id; return new; end $$;
create trigger messages_touch after insert on public.messages for each row execute function public.touch_conversation();

create table public.saved_professionals (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, professional_id)
);

-- ---------- bookings ----------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('BK-' || lpad(nextval('public.booking_ref_seq')::text, 7, '0')),
  customer_id uuid not null references public.profiles(id),
  professional_id uuid not null references public.professional_profiles(id),
  service_id uuid references public.professional_services(id),
  conversation_id uuid references public.conversations(id),
  quotation_id uuid,
  status public.booking_status not null default 'pending',
  title text not null,
  description text,
  location_id uuid references public.locations(id),
  address_text text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  agreed_amount_minor bigint check (agreed_amount_minor >= 0),
  currency char(3) not null default 'NGN',
  agreed_snapshot jsonb,                 -- immutable once set
  cancelled_by public.booking_actor,
  cancel_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_customer_idx on public.bookings(customer_id, status);
create index bookings_pro_idx on public.bookings(professional_id, status);

create table public.booking_transitions (
  from_status public.booking_status not null,
  to_status public.booking_status not null,
  actor public.booking_actor not null,
  primary key (from_status, to_status, actor)
);
create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  actor_role public.booking_actor not null,
  from_status public.booking_status,
  to_status public.booking_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index booking_events_idx on public.booking_events(booking_id, created_at);
create table public.job_updates (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  message text,
  media_paths text[] not null default '{}',
  is_completion_evidence boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.booking_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  description text not null,
  amount_delta_minor bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_booking_participant(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bookings b where b.id = bid and (b.customer_id = auth.uid() or public.owns_professional(b.professional_id))) $$;

create or replace function public.lock_booking_snapshot() returns trigger language plpgsql as $$
begin
  if old.agreed_snapshot is not null and (new.agreed_snapshot is distinct from old.agreed_snapshot
     or new.agreed_amount_minor is distinct from old.agreed_amount_minor or new.quotation_id is distinct from old.quotation_id) then
    raise exception 'the agreed scope and amount are immutable; use a change request'; end if;
  return new;
end $$;
create trigger bookings_lock before update on public.bookings for each row execute function public.lock_booking_snapshot();

-- ---------- quotations ----------
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('Q-' || lpad(nextval('public.quotation_no_seq')::text, 7, '0')),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id),
  customer_id uuid not null references public.profiles(id),
  version int not null default 1,
  parent_quotation_id uuid references public.quotations(id),
  status public.quotation_status not null default 'draft',
  job_description text,
  scope_of_work text,
  total_minor bigint not null default 0 check (total_minor >= 0),
  currency char(3) not null default 'NGN',
  valid_until timestamptz,
  estimated_completion_on date,
  proposed_start timestamptz,
  terms text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, version)
);
alter table public.bookings add constraint bookings_quotation_fk foreign key (quotation_id) references public.quotations(id);
create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  kind text not null check (kind in ('labour','material','additional','discount')),
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  amount_minor bigint generated always as (round(quantity * unit_price_minor)::bigint) stored
);
create table public.quotation_revisions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  revision_no int not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (quotation_id, revision_no)
);

create or replace function public.recalc_quotation_total() returns trigger language plpgsql security definer set search_path = public as $$
declare qid uuid := coalesce(new.quotation_id, old.quotation_id);
begin
  perform public.internal_flag_on();
  update public.quotations q set total_minor = greatest(0, coalesce((
    select sum(case when kind = 'discount' then -amount_minor else amount_minor end) from public.quotation_items where quotation_id = qid), 0))
   where q.id = qid;
  return null;
end $$;
create trigger items_recalc after insert or update or delete on public.quotation_items
  for each row execute function public.recalc_quotation_total();

create or replace function public.guard_quotation() returns trigger language plpgsql as $$
begin
  if old.status = 'accepted' then raise exception 'an accepted quotation is immutable'; end if;
  if not public.is_privileged() and old.status <> 'draft' then raise exception 'only draft quotations can be edited; create a revision'; end if;
  return new;
end $$;
create trigger quotations_guard before update on public.quotations for each row execute function public.guard_quotation();

create or replace function public.guard_quotation_items() returns trigger language plpgsql as $$
declare st public.quotation_status;
begin
  select status into st from public.quotations where id = coalesce(new.quotation_id, old.quotation_id);
  if st <> 'draft' and not public.is_service_role() then raise exception 'items are locked once a quotation is sent'; end if;
  return coalesce(new, old);
end $$;
create trigger quotation_items_guard before insert or update or delete on public.quotation_items
  for each row execute function public.guard_quotation_items();

-- ---------- reviews ----------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id),
  customer_id uuid not null references public.profiles(id),
  professional_id uuid not null references public.professional_profiles(id),
  rating_overall smallint not null check (rating_overall between 1 and 5),
  rating_quality smallint check (rating_quality between 1 and 5),
  rating_communication smallint check (rating_communication between 1 and 5),
  rating_punctuality smallint check (rating_punctuality between 1 and 5),
  rating_value smallint check (rating_value between 1 and 5),
  body text,
  photo_paths text[] not null default '{}',
  status text not null default 'published' check (status in ('published','reported','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.review_responses (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  reason text not null,
  status text not null default 'open' check (status in ('open','upheld','dismissed')),
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);

create or replace function public.review_eligibility() returns trigger language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = new.booking_id;
  if b.id is null or b.status <> 'completed' then raise exception 'only completed bookings can be reviewed'; end if;
  new.customer_id := b.customer_id; new.professional_id := b.professional_id;
  if not public.is_privileged() and auth.uid() <> b.customer_id then raise exception 'only the booking customer can review'; end if;
  return new;
end $$;
create trigger reviews_eligibility before insert on public.reviews for each row execute function public.review_eligibility();

create or replace function public.refresh_pro_rating() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.professional_id, old.professional_id);
begin
  perform public.internal_flag_on();
  update public.professional_profiles p set
    review_count = (select count(*) from public.reviews r where r.professional_id = pid and r.status = 'published'),
    rating_avg = coalesce((select round(avg(rating_overall)::numeric, 2) from public.reviews r where r.professional_id = pid and r.status = 'published'), 0)
  where p.id = pid;
  return null;
end $$;
create trigger reviews_refresh after insert or update or delete on public.reviews for each row execute function public.refresh_pro_rating();

create or replace function public.refresh_completed_jobs() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.internal_flag_on();
  update public.professional_profiles set completed_jobs =
    (select count(*) from public.bookings where professional_id = new.professional_id and status = 'completed')
   where id = new.professional_id;
  return null;
end $$;
create trigger bookings_completed after update of status on public.bookings
  for each row when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.refresh_completed_jobs();

-- ---------- disputes ----------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('DSP-' || lpad(nextval('public.dispute_ref_seq')::text, 6, '0')),
  booking_id uuid not null references public.bookings(id),   -- every complaint references a booking
  raised_by uuid not null references public.profiles(id),
  customer_id uuid not null references public.profiles(id),
  professional_id uuid not null references public.professional_profiles(id),
  reason text not null,
  description text,
  status public.dispute_status not null default 'submitted',
  assigned_admin_id uuid references public.profiles(id),
  resolution_notes text,
  resolution_type text,
  refund_amount_minor bigint check (refund_amount_minor >= 0),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index disputes_status_idx on public.disputes(status);
create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null,
  note text,
  created_at timestamptz not null default now()
);
create or replace function public.is_dispute_participant(did uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.disputes d where d.id = did and (d.customer_id = auth.uid() or public.owns_professional(d.professional_id))) $$;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
