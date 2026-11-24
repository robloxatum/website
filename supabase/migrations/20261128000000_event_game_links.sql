-- Live game links: a Roblox private server link an officer posts during an
-- event, so checked-in members can jump straight into the game.
--
-- Who can see it: officers always; a member only while they're checked in to
-- that event AND the event is live (starts_at <= now() < ends_at).
-- Who can change it: officers only.
--
-- "Updates live": a trigger broadcasts an EMPTY "changed" message on the
-- private Realtime topic game:<event id>. The link itself is never sent over
-- Realtime: clients re-read it through the RLS policy below.

-------------------------------------------------------------------------------
-- Table
-------------------------------------------------------------------------------

create table public.event_game_links (
  event_id uuid primary key references public.events (id) on delete cascade,
  -- https://roblox.com/... or https://www.roblox.com/... only (the app also
  -- parses and normalizes it). No spaces, quotes or angle brackets.
  url text not null
    constraint event_game_links_url_check
    check (char_length(url) <= 500 and url ~ '^https://(www\.)?roblox\.com/[^\s"''<>\\]*$'),
  label text
    constraint event_game_links_label_check
    check (label is null or char_length(label) between 1 and 60),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null
);

alter table public.event_game_links enable row level security;

-------------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER: they read attendance/events without depending on
-- those tables' own policies; they only ever check the CALLER's attendance).
-------------------------------------------------------------------------------

-- The caller is checked in to the event (umich.edu accounts only).
create or replace function private.is_checked_in(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_umich() and exists (
    select 1 from public.attendance a
     where a.event_id = p_event_id and a.user_id = (select auth.uid())
  )
$$;

-- The caller is checked in to the event and it's live right now.
create or replace function private.can_read_game_link(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_checked_in(p_event_id) and exists (
    select 1 from public.events e
     where e.id = p_event_id and e.starts_at <= now() and now() < e.ends_at
  )
$$;

revoke execute on function private.is_checked_in(uuid) from public, anon;
revoke execute on function private.can_read_game_link(uuid) from public, anon;
grant execute on function private.is_checked_in(uuid) to authenticated;
grant execute on function private.can_read_game_link(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Grants and policies
-------------------------------------------------------------------------------

revoke all on public.event_game_links from anon, authenticated;
grant select, insert, update, delete on public.event_game_links to authenticated;

create policy "Officers, and checked-in members while the event is live, read game links"
  on public.event_game_links for select to authenticated
  using ((select private.is_officer()) or private.can_read_game_link(event_id));

create policy "Officers post game links"
  on public.event_game_links for insert to authenticated
  with check ((select private.is_officer()));

create policy "Officers replace game links"
  on public.event_game_links for update to authenticated
  using ((select private.is_officer()))
  with check ((select private.is_officer()));

create policy "Officers clear game links"
  on public.event_game_links for delete to authenticated
  using ((select private.is_officer()));

-------------------------------------------------------------------------------
-- Realtime: "the link changed" (no payload) on game:<event id>
-------------------------------------------------------------------------------

create or replace function private.broadcast_game_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      '{}'::jsonb,                                                   -- no link, ever
      'changed',
      'game:' || coalesce(new.event_id, old.event_id)::text,
      true                                                           -- private channel
    );
  exception when others then
    -- A missed live update must never block saving the link (clients also poll).
    raise warning 'broadcast_game_link_change failed: %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function private.broadcast_game_link_change() from public, anon, authenticated;

create trigger event_game_links_broadcast
  after insert or update or delete on public.event_game_links
  for each row execute function private.broadcast_game_link_change();

-- Officers and members checked in to the event may listen. The message is
-- empty, so listening early (before the event starts) reveals nothing; the
-- link itself stays behind the select policy above.
create policy "Officers and checked-in members receive game link changes"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) ~ '^game:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      (select private.is_officer())
      or private.is_checked_in(substring((select realtime.topic()) from 6)::uuid)
    )
  );
