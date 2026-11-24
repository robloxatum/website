-- Redesign: event categories and capacity, aggregate-only public stats, and
-- richer check-in results. Additive only: the live site keeps working.

-------------------------------------------------------------------------------
-- events.category and events.capacity
-------------------------------------------------------------------------------

alter table public.events
  add column category text not null default 'meeting'
    constraint events_category_check
    check (category in ('game_night', 'workshop', 'game_jam', 'social', 'meeting', 'partner')),
  add column capacity int
    constraint events_capacity_check
    check (capacity is null or capacity between 1 and 100000);

-- RLS is unchanged: anyone may read events, officers may write them (the
-- existing table-level grants and policies cover the new columns).

-------------------------------------------------------------------------------
-- Public, aggregate-only numbers. No names, ids of members or per-member rows.
-------------------------------------------------------------------------------

create or replace function public.public_stats()
returns table (members int, events_held int, total_checkins int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.profiles),
    (select count(*)::int from public.events where ends_at <= now()),
    (select count(*)::int from public.attendance)
$$;

-- Attendance totals for events that have ENDED. Upcoming and live events are
-- never included, so nobody can watch a room fill up from outside.
create or replace function public.public_past_event_counts()
returns table (event_id uuid, attendance int)
language sql
stable
security definer
set search_path = ''
as $$
  select a.event_id, count(*)::int
    from public.attendance a
    join public.events e on e.id = a.event_id
   where e.ends_at <= now()
   group by a.event_id
$$;

revoke execute on function public.public_stats() from public;
revoke execute on function public.public_past_event_counts() from public;
grant execute on function public.public_stats() to anon, authenticated;
grant execute on function public.public_past_event_counts() to anon, authenticated;

-------------------------------------------------------------------------------
-- check_in(): same rules, same statuses, plus the event's PUBLIC details for
-- the check-in screen. Codes are still never returned. "event_title" stays for
-- the current live site.
-------------------------------------------------------------------------------

create or replace function public.check_in(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_max_failures constant int := 10;
  c_window constant interval := interval '10 minutes';
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_event public.events%rowtype;
  v_failures int;
  v_public jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'not_signed_in', 'event_title', null, 'event', null);
  end if;
  if not private.is_umich() then
    return jsonb_build_object('status', 'not_umich', 'event_title', null, 'event', null);
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    return jsonb_build_object('status', 'no_profile', 'event_title', null, 'event', null);
  end if;

  -- Rate limit wrong codes per user.
  delete from private.checkin_failures
   where user_id = v_uid and attempted_at < now() - interval '1 day';
  select count(*) into v_failures
    from private.checkin_failures
   where user_id = v_uid and attempted_at > now() - c_window;
  if v_failures >= c_max_failures then
    return jsonb_build_object('status', 'rate_limited', 'event_title', null, 'event', null);
  end if;

  if v_code ~ '^[A-HJ-NP-Z]{5}$' then
    select e.* into v_event
      from public.event_codes c
      join public.events e on e.id = c.event_id
     where c.code = v_code;
  end if;

  if v_event.id is null then
    insert into private.checkin_failures (user_id) values (v_uid);
    return jsonb_build_object('status', 'invalid_code', 'event_title', null, 'event', null);
  end if;

  -- Only fields that are already public on /events.
  v_public := jsonb_build_object(
    'id', v_event.id,
    'title', v_event.title,
    'starts_at', v_event.starts_at,
    'ends_at', v_event.ends_at,
    'location', v_event.location,
    'category', v_event.category
  );

  if exists (
    select 1 from public.attendance a
     where a.event_id = v_event.id and a.user_id = v_uid
  ) then
    return jsonb_build_object('status', 'already_checked_in', 'event_title', v_event.title, 'event', v_public);
  end if;

  if not public.checkin_is_open(v_event) then
    return jsonb_build_object('status', 'closed', 'event_title', v_event.title, 'event', v_public);
  end if;

  insert into public.attendance (event_id, user_id)
  values (v_event.id, v_uid)
  on conflict (event_id, user_id) do nothing;

  if not found then -- lost a race with a double tap
    return jsonb_build_object('status', 'already_checked_in', 'event_title', v_event.title, 'event', v_public);
  end if;

  return jsonb_build_object('status', 'ok', 'event_title', v_event.title, 'event', v_public);
end;
$$;

revoke execute on function public.check_in(text) from public, anon;
grant execute on function public.check_in(text) to authenticated;
