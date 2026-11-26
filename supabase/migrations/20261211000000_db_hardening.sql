-- Database hardening from security audit 2.
--
--  M1     At most 10 push devices per member (the oldest go first), so one
--         account can't flood the reminder job with thousands of devices.
--  Low 2  check_in takes a per-member lock, so a burst of parallel wrong
--         guesses can't slip past the 10-per-10-minutes limit.
--  Low 3  push_subscriptions only accepts the push services the sender
--         allows (lib/push/subscription.ts): no other hosts, no localhost.
--  Low 6  announcement links: same rule as the featured panel (no "." or ".."
--         path segments, so "/..//evil.com" can't become another site).
--  Low 7  public.take_roblox_lookup(): about 20 Roblox username lookups a
--         minute per member (the profile's "Is this you?" check and save).
--
-- Existing data is brought in line first, so the new checks always apply:
-- members over 10 devices keep their 10 newest; devices on other hosts are
-- removed (they could never be sent to); announcement links that break the
-- new rule are cleared (the announcement itself stays).

-------------------------------------------------------------------------------
-- Low 3: push-service hosts only
-------------------------------------------------------------------------------

delete from public.push_subscriptions
 where char_length(endpoint) > 1000
    or endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/';

alter table public.push_subscriptions drop constraint push_subscriptions_endpoint_check;
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_check check (
  char_length(endpoint) <= 1000
  and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
);

-------------------------------------------------------------------------------
-- M1: at most 10 devices per member
-------------------------------------------------------------------------------

-- Existing members over the cap keep their 10 most recently updated devices.
delete from public.push_subscriptions s
 using (
   select id, row_number() over (partition by user_id order by updated_at desc, created_at desc, id) as n
     from public.push_subscriptions
 ) ranked
 where ranked.id = s.id and ranked.n > 10;

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id, updated_at desc);

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_event_reminders boolean default null,
  p_game_links boolean default null,
  p_replaces text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_devices constant int := 10;
  v_user uuid := (select auth.uid());
  v_old public.push_subscriptions;
begin
  if v_user is null or not private.is_umich() then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  -- One save at a time per member, so parallel saves can't pass the cap.
  perform pg_advisory_xact_lock(hashtextextended('push_subscriptions:' || v_user::text, 0));

  if p_replaces is not null and p_replaces <> p_endpoint then
    delete from public.push_subscriptions where endpoint = p_replaces and user_id = v_user
      returning * into v_old;
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, event_reminders, game_links)
  values (v_user, p_endpoint, p_p256dh, p_auth,
          coalesce(p_event_reminders, v_old.event_reminders, true),
          coalesce(p_game_links, v_old.game_links, true))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        event_reminders = coalesce(p_event_reminders, push_subscriptions.event_reminders),
        game_links = coalesce(p_game_links, push_subscriptions.game_links),
        updated_at = now();

  -- Over the cap: the member's oldest devices go (never the one just saved).
  delete from public.push_subscriptions s
   where s.user_id = v_user
     and s.endpoint <> p_endpoint
     and s.id not in (
       select k.id from public.push_subscriptions k
        where k.user_id = v_user
        order by (k.endpoint = p_endpoint) desc, k.updated_at desc, k.created_at desc, k.id
        limit c_max_devices
     );
end;
$$;

-------------------------------------------------------------------------------
-- Low 2: check_in, one attempt at a time per member
-------------------------------------------------------------------------------

create or replace function public.check_in(p_code text)
returns jsonb
language plpgsql
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

  -- One attempt at a time per member: a parallel burst waits here, and each
  -- attempt then sees the failures recorded before it (READ COMMITTED takes
  -- a fresh snapshot per statement), so none can slip past the limit.
  perform pg_advisory_xact_lock(hashtextextended('check_in:' || v_uid::text, 0));

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

-------------------------------------------------------------------------------
-- Low 6: announcement links, same rule as the featured panel
-------------------------------------------------------------------------------

update public.announcements
   set link = null
 where link is not null
   and not (
     char_length(link) <= 500
     and (
       (link ~ '^/([^/\\\s"''<>][^\s"''<>\\]*)?$' and link !~* '(^|/)(\.|%2e){1,2}(/|[?#]|$)')
       or link ~ '^https://([a-z0-9-]+\.)*(roblox\.com|umich\.edu)(/[^\s"''<>\\]*)?$'
     )
   );

alter table public.announcements drop constraint announcements_link_check;
alter table public.announcements add constraint announcements_link_check check (
  link is null
  or (
    char_length(link) <= 500
    and (
      (link ~ '^/([^/\\\s"''<>][^\s"''<>\\]*)?$' and link !~* '(^|/)(\.|%2e){1,2}(/|[?#]|$)')
      or link ~ '^https://([a-z0-9-]+\.)*(roblox\.com|umich\.edu)(/[^\s"''<>\\]*)?$'
    )
  )
);

-------------------------------------------------------------------------------
-- Low 7: Roblox username lookups, about 20 a minute per member
-------------------------------------------------------------------------------

create table private.roblox_lookups (
  user_id uuid not null references auth.users (id) on delete cascade,
  looked_up_at timestamptz not null default now()
);
create index roblox_lookups_user_idx on private.roblox_lookups (user_id, looked_up_at);
alter table private.roblox_lookups enable row level security;
revoke all on private.roblox_lookups from public, anon, authenticated;

-- True (and counted) if the signed-in member may look up a Roblox username
-- now; false once they've had 20 in the last minute (or aren't signed in).
create or replace function public.take_roblox_lookup()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_max constant int := 20;
  c_window constant interval := interval '1 minute';
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.is_umich() then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('roblox_lookups:' || v_uid::text, 0));
  delete from private.roblox_lookups where user_id = v_uid and looked_up_at <= now() - c_window;
  if (select count(*) from private.roblox_lookups where user_id = v_uid) >= c_max then
    return false;
  end if;
  insert into private.roblox_lookups (user_id) values (v_uid);
  return true;
end;
$$;

revoke execute on function public.take_roblox_lookup() from public, anon;
grant execute on function public.take_roblox_lookup() to authenticated;
