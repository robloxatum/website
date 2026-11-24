-- Roblox at UM website: initial schema.
--
-- Security model
--   * Every table has RLS enabled, plus explicit GRANTs so access never relies on
--     Supabase's default "grant everything to anon/authenticated".
--   * Event codes live in their own table that only officers can read.
--   * Members can't insert attendance directly; public.check_in() is the only path.
--   * profiles.is_officer can't be changed by an UPDATE from the API (column grants);
--     only public.set_officer(), which officers alone can call, changes it.
--   * Internal helpers live in the "private" schema, which the API doesn't expose.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-------------------------------------------------------------------------------
-- Helpers
-------------------------------------------------------------------------------

-- True when the caller's JWT email is a umich.edu address.
create or replace function private.is_umich()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(lower(auth.jwt() ->> 'email') like '%@umich.edu', false)
$$;

-------------------------------------------------------------------------------
-- profiles
-------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  uniqname text not null unique check (uniqname ~ '^[a-z0-9._-]{1,64}$'),
  full_name text not null default '' check (char_length(full_name) <= 100),
  roblox_username text check (roblox_username ~ '^[A-Za-z0-9_]{3,20}$'),
  is_officer boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- True when the caller is an officer. SECURITY DEFINER so RLS policies on
-- profiles can call it without recursing into profiles' own policies.
create or replace function private.is_officer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_officer from public.profiles p where p.id = (select auth.uid())),
    false
  ) and private.is_umich()
$$;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Members may edit only these columns. uniqname comes from the email and
-- is_officer goes through set_officer().
grant update (full_name, roblox_username, onboarded_at) on public.profiles to authenticated;

create policy "Members read their own profile; officers read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_officer()));

create policy "Members update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select private.is_umich()))
  with check (id = (select auth.uid()));

-- Create a profile for each new umich.edu user. The uniqname is the email's
-- local part, so nobody can claim someone else's uniqname.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(new.email);
begin
  if v_email is null or v_email not like '%@umich.edu' then
    return new; -- The before-user-created hook should already have refused this.
  end if;

  insert into public.profiles (id, uniqname, full_name)
  values (
    new.id,
    split_part(v_email, '@', 1),
    left(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ), 100)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Supabase Auth "Before User Created" hook: refuse non-umich.edu accounts before
-- they are created. Enable it in Dashboard > Authentication > Hooks.
create or replace function public.hook_umich_only(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_email text := lower(event -> 'user' ->> 'email');
begin
  if v_email is not null and v_email like '%@umich.edu' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Please sign in with your umich.edu Google account.'
    )
  );
end;
$$;

revoke execute on function public.hook_umich_only(jsonb) from public, anon, authenticated;
grant execute on function public.hook_umich_only(jsonb) to supabase_auth_admin;

-------------------------------------------------------------------------------
-- events
-------------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  location text not null default '' check (char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Check-in is open while checkin_open is true and the event hasn't ended.
  -- If an officer reopens it after the end time, checkin_reopened is set and
  -- check-in stays open until an officer closes it.
  checkin_open boolean not null default false,
  checkin_reopened boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_ends_after_start check (ends_at > starts_at)
);

create index events_starts_at_idx on public.events (starts_at);

alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

create policy "Anyone can read events"
  on public.events for select to anon, authenticated
  using (true);

create policy "Officers create events"
  on public.events for insert to authenticated
  with check ((select private.is_officer()));

create policy "Officers update events"
  on public.events for update to authenticated
  using ((select private.is_officer()))
  with check ((select private.is_officer()));

create policy "Officers delete events"
  on public.events for delete to authenticated
  using ((select private.is_officer()));

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_touch_updated_at
  before update on public.events
  for each row execute function private.touch_updated_at();

-- Computed column: select=*,checkin_is_open through the API.
create or replace function public.checkin_is_open(e public.events)
returns boolean
language sql
stable
set search_path = ''
as $$
  select e.checkin_open and (e.checkin_reopened or now() < e.ends_at)
$$;

-- Open or close check-in. Opening after the end time counts as a manual reopen.
-- SECURITY INVOKER: the officer-only update policy on events applies.
create or replace function public.set_checkin_open(p_event_id uuid, p_open boolean)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_is_open boolean;
begin
  update public.events e
     set checkin_open = p_open,
         checkin_reopened = p_open and now() >= e.ends_at
   where e.id = p_event_id
  returning public.checkin_is_open(e) into v_is_open;

  if not found then
    raise exception 'Event not found or you are not an officer' using errcode = '42501';
  end if;

  return v_is_open;
end;
$$;

revoke execute on function public.set_checkin_open(uuid, boolean) from public, anon;
grant execute on function public.set_checkin_open(uuid, boolean) to authenticated;

-------------------------------------------------------------------------------
-- event_codes (officers only)
-------------------------------------------------------------------------------

create table public.event_codes (
  event_id uuid primary key references public.events (id) on delete cascade,
  -- 5 letters, no I or O.
  code text not null unique check (code ~ '^[A-HJ-NP-Z]{5}$')
);

alter table public.event_codes enable row level security;

revoke all on public.event_codes from anon, authenticated;
grant select on public.event_codes to authenticated;

create policy "Only officers read event codes"
  on public.event_codes for select to authenticated
  using ((select private.is_officer()));
-- No insert/update/delete policies: codes are written only by the
-- SECURITY DEFINER functions below.

-- Random 5-letter code from a 24-letter alphabet, using rejection sampling over
-- cryptographically random bytes so every letter is equally likely.
create or replace function private.random_event_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ'; -- 24 letters
  v_code text := '';
  v_bytes bytea;
  v_byte int;
  i int;
begin
  while char_length(v_code) < 5 loop
    v_bytes := extensions.gen_random_bytes(8);
    for i in 0..7 loop
      v_byte := get_byte(v_bytes, i);
      if v_byte < 240 and char_length(v_code) < 5 then -- 240 = 24 * 10
        v_code := v_code || substr(c_alphabet, (v_byte % 24) + 1, 1);
      end if;
    end loop;
  end loop;
  return v_code;
end;
$$;

-- Give an event a fresh unique code, retrying if a code is already taken.
create or replace function private.assign_event_code(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_attempt int := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_code := private.random_event_code();
    begin
      insert into public.event_codes (event_id, code)
      values (p_event_id, v_code)
      on conflict (event_id) do update set code = excluded.code;
      return v_code;
    exception when unique_violation then
      if v_attempt >= 20 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

create or replace function private.handle_new_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assign_event_code(new.id);
  return new;
end;
$$;

create trigger events_assign_code
  after insert on public.events
  for each row execute function private.handle_new_event();

-- Officers can replace a leaked code.
create or replace function public.regenerate_event_code(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_officer() then
    raise exception 'Only officers can change event codes' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  return private.assign_event_code(p_event_id);
end;
$$;

revoke execute on function public.regenerate_event_code(uuid) from public, anon;
grant execute on function public.regenerate_event_code(uuid) to authenticated;

-------------------------------------------------------------------------------
-- attendance
-------------------------------------------------------------------------------

create table public.attendance (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index attendance_user_id_idx on public.attendance (user_id);

alter table public.attendance enable row level security;

revoke all on public.attendance from anon, authenticated;
grant select, delete on public.attendance to authenticated;
-- No INSERT grant: members check in only through public.check_in().

create policy "Members read their own attendance; officers read all"
  on public.attendance for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_officer()));

create policy "Officers remove attendance"
  on public.attendance for delete to authenticated
  using ((select private.is_officer()));

-- Failed check-in attempts, for rate limiting. Not exposed through the API.
create table private.checkin_failures (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index checkin_failures_user_time_idx on private.checkin_failures (user_id, attempted_at);
alter table private.checkin_failures enable row level security;
revoke all on private.checkin_failures from public, anon, authenticated;

-- The only way members create attendance. Returns
--   { "status": "ok" | "already_checked_in" | "closed" | "invalid_code"
--               | "rate_limited" | "not_signed_in" | "not_umich" | "no_profile",
--     "event_title": text | null }
-- Codes are never returned.
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
begin
  if v_uid is null then
    return jsonb_build_object('status', 'not_signed_in', 'event_title', null);
  end if;
  if not private.is_umich() then
    return jsonb_build_object('status', 'not_umich', 'event_title', null);
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    return jsonb_build_object('status', 'no_profile', 'event_title', null);
  end if;

  -- Rate limit wrong codes per user.
  delete from private.checkin_failures
   where user_id = v_uid and attempted_at < now() - interval '1 day';
  select count(*) into v_failures
    from private.checkin_failures
   where user_id = v_uid and attempted_at > now() - c_window;
  if v_failures >= c_max_failures then
    return jsonb_build_object('status', 'rate_limited', 'event_title', null);
  end if;

  if v_code ~ '^[A-HJ-NP-Z]{5}$' then
    select e.* into v_event
      from public.event_codes c
      join public.events e on e.id = c.event_id
     where c.code = v_code;
  end if;

  if v_event.id is null then
    insert into private.checkin_failures (user_id) values (v_uid);
    return jsonb_build_object('status', 'invalid_code', 'event_title', null);
  end if;

  if exists (
    select 1 from public.attendance a
     where a.event_id = v_event.id and a.user_id = v_uid
  ) then
    return jsonb_build_object('status', 'already_checked_in', 'event_title', v_event.title);
  end if;

  if not public.checkin_is_open(v_event) then
    return jsonb_build_object('status', 'closed', 'event_title', v_event.title);
  end if;

  insert into public.attendance (event_id, user_id)
  values (v_event.id, v_uid)
  on conflict (event_id, user_id) do nothing;

  if not found then -- lost a race with a double tap
    return jsonb_build_object('status', 'already_checked_in', 'event_title', v_event.title);
  end if;

  return jsonb_build_object('status', 'ok', 'event_title', v_event.title);
end;
$$;

revoke execute on function public.check_in(text) from public, anon;
grant execute on function public.check_in(text) to authenticated;

-------------------------------------------------------------------------------
-- Officer management
-------------------------------------------------------------------------------

-- Make or remove an officer. Only officers may call it, and the last officer
-- can't be removed. An advisory lock serializes concurrent calls so two officers
-- can't remove each other at the same moment.
create or replace function public.set_officer(p_user_id uuid, p_is_officer boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.set_officer'));

  if not private.is_officer() then
    raise exception 'Only officers can change officer status' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  if not p_is_officer and not exists (
    select 1 from public.profiles
     where is_officer and id <> p_user_id
  ) then
    raise exception 'You can''t remove the last officer' using errcode = 'P0001';
  end if;

  update public.profiles set is_officer = p_is_officer where id = p_user_id;
end;
$$;

revoke execute on function public.set_officer(uuid, boolean) from public, anon;
grant execute on function public.set_officer(uuid, boolean) to authenticated;

-------------------------------------------------------------------------------
-- Members overview (RLS of the underlying tables applies)
-------------------------------------------------------------------------------

create view public.member_attendance
with (security_invoker = true)
as
select
  p.id,
  p.uniqname,
  p.full_name,
  p.roblox_username,
  p.is_officer,
  p.created_at,
  count(a.event_id)::int as total_attendance,
  max(a.checked_in_at) as last_checked_in_at
from public.profiles p
left join public.attendance a on a.user_id = p.id
group by p.id;

revoke all on public.member_attendance from anon, authenticated;
grant select on public.member_attendance to authenticated;

-------------------------------------------------------------------------------
-- Lock down internal functions (Postgres grants EXECUTE to PUBLIC by default)
-------------------------------------------------------------------------------

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_umich() to anon, authenticated;
grant execute on function private.is_officer() to anon, authenticated;

revoke execute on function public.checkin_is_open(public.events) from public;
grant execute on function public.checkin_is_open(public.events) to anon, authenticated;

-------------------------------------------------------------------------------
-- Realtime: live check-in count on the present page (RLS applies to subscribers)
-------------------------------------------------------------------------------

alter publication supabase_realtime add table public.attendance;
