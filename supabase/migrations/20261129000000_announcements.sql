-- Announcement banner: one short message shown under the header on every
-- public page. Anyone can read the active one; only officers can write.
--
-- At most one row exists: publishing replaces it (new id, so visitors who
-- dismissed the old one see the new one); clearing deletes it.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null
    constraint announcements_message_check
    check (char_length(message) between 1 and 140 and message = btrim(message)),
  -- Our own site (a path like "/events"), or https on roblox.com / umich.edu
  -- (and their subdomains). No "//host" paths, no other schemes.
  link text
    constraint announcements_link_check
    check (
      link is null or (
        char_length(link) <= 500
        and (
          link ~ '^/([^/\\\s"''<>][^\s"''<>\\]*)?$'
          or link ~ '^https://([a-z0-9-]+\.)*(roblox\.com|umich\.edu)(/[^\s"''<>\\]*)?$'
        )
      )
    ),
  style text not null default 'info'
    constraint announcements_style_check check (style in ('info', 'urgent')),
  -- Optional: stop showing it after this time.
  hide_after timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);

-- Only one announcement at a time.
create unique index announcements_single on public.announcements ((true));

alter table public.announcements enable row level security;

revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;

-- Everyone sees the announcement until its hide-after time; officers always
-- see it (so the officer page can show an expired one).
create policy "Anyone reads the active announcement; officers read it always"
  on public.announcements for select to anon, authenticated
  using (hide_after is null or hide_after > now() or (select private.is_officer()));

create policy "Officers publish announcements"
  on public.announcements for insert to authenticated
  with check ((select private.is_officer()));

create policy "Officers edit announcements"
  on public.announcements for update to authenticated
  using ((select private.is_officer()))
  with check ((select private.is_officer()));

create policy "Officers clear announcements"
  on public.announcements for delete to authenticated
  using ((select private.is_officer()));
