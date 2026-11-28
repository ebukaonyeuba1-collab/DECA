-- DECA Stage 3.1 | 0015 | admin professional management: filtered listing and status counts
-- NO new tables and NO new status fields. Status comes from professional_profiles.verification_status (kept in sync with the
-- application by existing triggers); history comes from verification_events. These two read-only functions exist only because
-- searching across several tables with a location hierarchy cannot be expressed safely in client-side filters.

create or replace function public.admin_list_professionals(
  p_group text default 'pending', p_status public.verification_status default null, p_query text default null,
  p_category text default null, p_location uuid default null, p_limit int default 20, p_offset int default 0)
returns table (
  professional_id uuid, application_id uuid, display_name text, slug text, account_type public.account_type, business_name text,
  category_name text, location_label text, status public.verification_status, is_listed boolean,
  submitted_at timestamptz, reviewed_at timestamptz, decision_reason text, reviewed_by_name text, joined_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_group text := case when p_group in ('pending','approved','rejected','suspended','not_started','all') then p_group else 'pending' end;
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_q text := nullif(trim(coalesce(p_query, '')), '');
  v_like text;
begin
  if not (public.is_admin() or public.is_service_role()) then raise exception 'administrator only'; end if;
  if v_q is not null then
    v_q := left(v_q, 80);
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  return query
  with recursive up as (select l.id, l.parent_id from public.locations l where l.id = p_location
                        union all select l.id, l.parent_id from public.locations l join up on l.id = up.parent_id),
       down as (select l.id from public.locations l where l.id = p_location
                union all select l.id from public.locations l join down d on l.parent_id = d.id),
       loc_match as (select up.id from up union select down.id from down),
  base as (
    select pp.id as pid, a.id as aid, pp.display_name as dname, pp.slug as pslug, pp.account_type as atype, b.registered_name as bname,
           c.name as cname, case when pl.id is null then null else coalesce(pl.name || ', ' || pp2.name, pl.name) end as lbl,
           pp.verification_status as st, pp.is_listed as listed, a.submitted_at as sub_at, a.reviewed_at as rev_at,
           a.decision_reason as reason, rv.full_name as rvname, pp.created_at as created
      from public.professional_profiles pp
      join public.profiles pr on pr.id = pp.user_id
      left join public.businesses b on b.id = pp.business_id
      left join public.service_categories c on c.id = pp.primary_category_id
      left join public.verification_applications a on a.professional_id = pp.id
      left join public.profiles rv on rv.id = a.reviewed_by
      left join public.locations pl on pl.id = pr.location_id
      left join public.locations pp2 on pp2.id = pl.parent_id
     where pp.deleted_at is null
       and (case v_group
              when 'pending' then pp.verification_status in ('submitted','under_review','additional_information_required')
              when 'approved' then pp.verification_status = 'approved'
              when 'rejected' then pp.verification_status = 'rejected'
              when 'suspended' then pp.verification_status = 'suspended'
              when 'not_started' then pp.verification_status in ('not_started','incomplete')
              else true end)
       and (p_status is null or pp.verification_status = p_status)
       and (v_q is null or pp.display_name ilike v_like or coalesce(b.registered_name, '') ilike v_like or coalesce(pr.email, '') ilike v_like)
       and (p_category is null or c.slug = p_category
            or exists (select 1 from public.professional_services s join public.service_categories sc on sc.id = s.category_id
                        where s.professional_id = pp.id and s.deleted_at is null and sc.slug = p_category))
       and (p_location is null or pr.location_id in (select loc_match.id from loc_match)
            or exists (select 1 from public.service_locations sl where sl.professional_id = pp.id and sl.location_id in (select loc_match.id from loc_match)))
  )
  select b.pid, b.aid, b.dname, b.pslug, b.atype, b.bname, b.cname, b.lbl, b.st, b.listed, b.sub_at, b.rev_at, b.reason, b.rvname, b.created, count(*) over ()
    from base b
   order by case when v_group = 'pending' then b.sub_at end asc nulls last,
            case when v_group <> 'pending' then coalesce(b.rev_at, b.created) end desc nulls last,
            b.dname, b.pid
   limit v_limit offset v_offset;
end $$;

create or replace function public.admin_verification_counts() returns table (grp text, n bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_service_role()) then raise exception 'administrator only'; end if;
  return query
  select g.grp, count(pp.id) filter (where
      case g.grp when 'pending' then pp.verification_status in ('submitted','under_review','additional_information_required')
                 when 'approved' then pp.verification_status = 'approved' when 'rejected' then pp.verification_status = 'rejected'
                 when 'suspended' then pp.verification_status = 'suspended' when 'not_started' then pp.verification_status in ('not_started','incomplete')
                 else true end)
    from (values ('pending'),('approved'),('rejected'),('suspended'),('not_started'),('all')) g(grp)
    left join public.professional_profiles pp on pp.deleted_at is null
   group by g.grp;
end $$;

do $$ declare f text; begin
  foreach f in array array['admin_list_professionals(text,public.verification_status,text,text,uuid,int,int)','admin_verification_counts()']
  loop execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated, service_role', f); end loop;
end $$;

-- History must order reliably: now() is the transaction start, so two events in one transaction would tie.
alter table public.verification_events alter column created_at set default clock_timestamp();

-- The application row shows the LATEST decision only. Earlier reasons live on in verification_events, so approving
-- after a rejection no longer leaves the old rejection reason displayed beside "Approved". (Replaces the 0009 definition.)
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
         decision_reason = nullif(trim(coalesce(p_reason, '')), ''), internal_notes = coalesce(p_notes, internal_notes)
   where id = p_application;
  insert into public.verification_events(application_id, actor_id, event_type, from_status, to_status, message)
    values (p_application, auth.uid(), 'admin_decision', old_status, p_decision, nullif(trim(coalesce(p_reason, '')), ''));
end $$;
revoke all on function public.review_verification(uuid, public.verification_status, text, text) from public, anon;
grant execute on function public.review_verification(uuid, public.verification_status, text, text) to authenticated, service_role;
