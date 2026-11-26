-- Several live game servers per event (was: one game link per event).
--
-- Each event can have up to 10 Roblox private server links, each with a
-- label, an order and a "Full" flag. Same rules as event_game_links:
--   read:  officers always; a member only while checked in to that event AND
--          the event is live (private.can_read_game_link);
--   write: officers only;
--   links: roblox.com / www.roblox.com over https only.
-- Changes broadcast the same EMPTY "changed" message on game:<event id>
-- (the existing Realtime policy already covers that topic), so clients re-read
-- through RLS and the links never travel over Realtime.
--
-- Rollout: this migration is additive and goes to the database BEFORE the app
-- that uses it. Until then the deployed app still reads and writes
-- event_game_links, so that table stays, and a trigger mirrors it into
-- event_game_servers (as the event's first server, id = event id), so a link
-- posted in between is already there when the new app goes live. A later
-- migration drops event_game_links once nothing uses it.

-------------------------------------------------------------------------------
-- Table
-------------------------------------------------------------------------------

create table public.event_game_servers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  url text not null
    constraint event_game_servers_url_check
    check (char_length(url) <= 500 and url ~ '^https://(www\.)?roblox\.com/[^\s"''<>\\]*$'),
  label text not null
    constraint event_game_servers_label_check
    check (char_length(label) between 1 and 60 and label !~ '[[:cntrl:]]'),
  position integer not null default 0
    constraint event_game_servers_position_check check (position between 0 and 1000),
  is_full boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null
);

create index event_game_servers_event_idx on public.event_game_servers (event_id, position, created_at);

alter table public.event_game_servers enable row level security;

-------------------------------------------------------------------------------
-- At most 10 servers per event (serialized per event, so two officers adding
-- at once can't both slip past the limit).
-------------------------------------------------------------------------------

create or replace function private.limit_game_servers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('event_game_servers:' || new.event_id::text, 0));
  if (select count(*) from public.event_game_servers s where s.event_id = new.event_id) >= 10 then
    raise exception 'An event can have at most 10 game servers' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function private.limit_game_servers() from public, anon, authenticated;

create trigger event_game_servers_limit
  before insert on public.event_game_servers
  for each row execute function private.limit_game_servers();

-- A server never moves to another event.
create or replace function private.keep_game_server_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_id is distinct from old.event_id then
    raise exception 'A game server cannot move to another event' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function private.keep_game_server_event() from public, anon, authenticated;

create trigger event_game_servers_keep_event
  before update on public.event_game_servers
  for each row execute function private.keep_game_server_event();

-------------------------------------------------------------------------------
-- Grants and policies (same rules as event_game_links)
-------------------------------------------------------------------------------

revoke all on public.event_game_servers from anon, authenticated;
grant select, insert, update, delete on public.event_game_servers to authenticated;

create policy "Officers, and checked-in members while the event is live, read game servers"
  on public.event_game_servers for select to authenticated
  using ((select private.is_officer()) or private.can_read_game_link(event_id));

create policy "Officers add game servers"
  on public.event_game_servers for insert to authenticated
  with check ((select private.is_officer()));

create policy "Officers edit game servers"
  on public.event_game_servers for update to authenticated
  using ((select private.is_officer()))
  with check ((select private.is_officer()));

create policy "Officers remove game servers"
  on public.event_game_servers for delete to authenticated
  using ((select private.is_officer()));

-- Same empty "changed" broadcast on game:<event id> as event_game_links.
create trigger event_game_servers_broadcast
  after insert or update or delete on public.event_game_servers
  for each row execute function private.broadcast_game_link_change();

-------------------------------------------------------------------------------
-- Reorder: one statement, so the order never ends up half-applied.
-- SECURITY INVOKER: the officer-only update policy above still applies.
-------------------------------------------------------------------------------

create or replace function public.reorder_game_servers(p_event_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_officer()) then
    raise exception 'Only officers can reorder game servers' using errcode = '42501';
  end if;
  update public.event_game_servers s
     set position = array_position(p_ids, s.id) - 1,
         updated_at = now(),
         updated_by = (select auth.uid())
   where s.event_id = p_event_id
     and s.id = any (p_ids)
     and s.position is distinct from array_position(p_ids, s.id) - 1;
end;
$$;

revoke execute on function public.reorder_game_servers(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_game_servers(uuid, uuid[]) to authenticated;

-------------------------------------------------------------------------------
-- "Suggested for you": the caller's place in the event's check-in order
-- (1 = first in). Only for a member who may read the servers right now;
-- null otherwise. Reveals only a count of earlier check-ins, never who.
-------------------------------------------------------------------------------

create or replace function public.my_checkin_order(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.can_read_game_link(p_event_id) then (
    select count(*)::integer
      from public.attendance a
     where a.event_id = p_event_id
       and (a.checked_in_at, a.user_id) <= (
         select m.checked_in_at, m.user_id from public.attendance m
          where m.event_id = p_event_id and m.user_id = (select auth.uid())
       )
  ) end
$$;

revoke execute on function public.my_checkin_order(uuid) from public, anon;
grant execute on function public.my_checkin_order(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Existing links become each event's first server, and (until the old app is
-- gone) links posted through event_game_links keep arriving here.
-------------------------------------------------------------------------------

insert into public.event_game_servers (id, event_id, url, label, position, updated_at, updated_by, created_at)
select l.event_id, l.event_id, l.url, coalesce(nullif(btrim(l.label), ''), 'Server 1'), 0, l.updated_at, l.updated_by, l.updated_at
  from public.event_game_links l
on conflict (id) do nothing;

create or replace function private.mirror_legacy_game_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.event_game_servers where id = old.event_id;
    return null;
  end if;
  insert into public.event_game_servers (id, event_id, url, label, position, updated_at, updated_by)
  values (new.event_id, new.event_id, new.url, coalesce(nullif(btrim(new.label), ''), 'Server 1'), 0, new.updated_at, new.updated_by)
  on conflict (id) do update
     set url = excluded.url, label = excluded.label, is_full = false,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return null;
end;
$$;

revoke execute on function private.mirror_legacy_game_link() from public, anon, authenticated;

create trigger event_game_links_mirror
  after insert or update or delete on public.event_game_links
  for each row execute function private.mirror_legacy_game_link();

comment on table public.event_game_links is
  'Deprecated: replaced by event_game_servers (mirrored into it). Drop once no deployed app uses it.';
