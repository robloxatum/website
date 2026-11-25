-- Officer analytics: one SECURITY DEFINER function that returns aggregates only
-- (counts per event, per category, per month, check-in timing buckets). It
-- never returns who checked in. Officers only; members and signed-out users
-- can't call it.
--
--   p_from  start of the range (null = all time)
--   p_to    end of the range, exclusive (null = now)
--
-- Events count toward a range by start time. The previous period (for the
-- "vs previous period" numbers) is the same length, right before p_from; it's
-- null for all time.

create or replace function public.officer_analytics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_to timestamptz := coalesce(p_to, clock_timestamp()); -- the current time, not the transaction start
  v_from timestamptz;
  v_prev_from timestamptz;
  v_month_start timestamptz;
  v_result jsonb;
begin
  if not private.is_officer() then
    raise exception 'Officers only' using errcode = '42501';
  end if;
  if p_from is not null and p_from >= v_to then
    raise exception 'The range must end after it starts' using errcode = '22023';
  end if;

  v_from := coalesce(p_from, '-infinity'::timestamptz);
  if p_from is not null then
    v_prev_from := p_from - (v_to - p_from);
  end if;
  -- Member growth starts at the range start, or the first member for all time.
  v_month_start := coalesce(p_from, (select min(created_at) from public.profiles), v_to);

  with
  ev as (
    select e.id, e.title, e.starts_at, e.category, e.cover_path, e.cover_width, e.cover_height
      from public.events e
     where e.starts_at >= v_from and e.starts_at < v_to
  ),
  -- Every check-in, marked when it's that member's first ever.
  att as (
    select a.event_id, a.user_id, a.checked_in_at,
           a.checked_in_at = min(a.checked_in_at) over (partition by a.user_id) as first_time
      from public.attendance a
  ),
  ev_att as (
    select att.*, ev.starts_at
      from att join ev on ev.id = att.event_id
  ),
  per_event as (
    select ev.id, ev.title, ev.starts_at, ev.category, ev.cover_path, ev.cover_width, ev.cover_height,
           (select count(*) from ev_att x where x.event_id = ev.id)::int as checkins,
           (select count(*) from ev_att x where x.event_id = ev.id and x.first_time)::int as first_timers,
           (select count(*) from public.event_rsvps r where r.event_id = ev.id)::int as rsvps,
           (select count(*) from public.event_rsvps r
             where r.event_id = ev.id
               and exists (select 1 from public.attendance a where a.event_id = r.event_id and a.user_id = r.user_id))::int as rsvps_showed
      from ev
  ),
  people as (
    select user_id, count(*) as events from ev_att group by user_id
  ),
  timing as (
    select extract(epoch from (checked_in_at - starts_at)) / 60 as minutes from ev_att
  ),
  months as (
    select m
      from generate_series(
        date_trunc('month', v_month_start at time zone 'America/Detroit'),
        date_trunc('month', (v_to - interval '1 microsecond') at time zone 'America/Detroit'), -- end is exclusive
        interval '1 month'
      ) m
  )
  select jsonb_build_object(
    'members_total', (select count(*) from public.profiles where created_at < v_to),
    'members_new', (select count(*) from public.profiles where created_at >= v_from and created_at < v_to),
    'members_before', (select count(*) from public.profiles where created_at < v_from),
    'checkins_all_time', (select count(*) from public.attendance),
    'events', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.starts_at) from per_event p
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', c.category, 'checkins', c.checkins) order by c.checkins desc, c.category)
        from (select category, sum(checkins)::int as checkins from per_event group by category) c
       where c.checkins > 0
    ), '[]'::jsonb),
    'growth', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(months.m, 'YYYY-MM'), 'new_members', (
        select count(*) from public.profiles p
         where p.created_at >= v_from and p.created_at < v_to
           and date_trunc('month', p.created_at at time zone 'America/Detroit') = months.m
      )) order by months.m)
        from months
    ), '[]'::jsonb),
    'returning', jsonb_build_object(
      'attendees', (select count(*) from people),
      'two_plus', (select count(*) from people where events >= 2)
    ),
    'timing', jsonb_build_object(
      'before_start', (select count(*) from timing where minutes < 0),
      'min_0_10', (select count(*) from timing where minutes >= 0 and minutes < 10),
      'min_10_20', (select count(*) from timing where minutes >= 10 and minutes < 20),
      'min_20_30', (select count(*) from timing where minutes >= 20 and minutes < 30),
      'min_30_60', (select count(*) from timing where minutes >= 30 and minutes < 60),
      'min_60_plus', (select count(*) from timing where minutes >= 60),
      'median', (select round((percentile_cont(0.5) within group (order by minutes))::numeric)::int from timing),
      'p80', (select round((percentile_cont(0.8) within group (order by minutes))::numeric)::int from timing)
    ),
    'prev', case when v_prev_from is null then null else jsonb_build_object(
      'events', (select count(*) from public.events e where e.starts_at >= v_prev_from and e.starts_at < p_from),
      'checkins', (select count(*) from public.attendance a join public.events e on e.id = a.event_id
                    where e.starts_at >= v_prev_from and e.starts_at < p_from),
      'members_new', (select count(*) from public.profiles where created_at >= v_prev_from and created_at < p_from)
    ) end
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.officer_analytics(timestamptz, timestamptz) from public, anon;
grant execute on function public.officer_analytics(timestamptz, timestamptz) to authenticated;
