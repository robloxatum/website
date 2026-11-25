-- Site content officers can edit from /officer/content:
--   * community_links   the community links (/links, /join, "You're in!", footer)
--   * join_faq          the Join page FAQ
--   * join_what_we_do   the four "What we do" cards (home and /join)
--   * featured_panel    the Featured panel on the home page (one row)
--
-- Anyone can read the content (hidden links only by officers); only officers
-- change it, through the save_* functions below, which replace a section in one
-- transaction and refuse to overwrite an edit made since the officer loaded it.
--
-- Who edited a section last, and when, is in site_content_edits. It's written
-- by triggers (auth.uid(), so it can't be forged) and only officers can read
-- it: like events.created_by, who edited is not public.
--
-- Seeded with exactly the content that was in src/lib/links.ts,
-- src/content/join.ts and src/content/highlights.ts, so the site looks the
-- same after the switch. The email link stays in code (it's mailto:, and these
-- links are https only).
--
-- Text is plain: trimmed, single-line, no control characters and nothing that
-- looks like an HTML tag. (React escapes it anyway; this keeps it clean.)

-------------------------------------------------------------------------------
-- Community links
-------------------------------------------------------------------------------
create table public.community_links (
  id uuid primary key default gen_random_uuid(),
  position int not null constraint community_links_position_check check (position >= 0),
  label text not null
    constraint community_links_label_check
    check (char_length(label) between 1 and 40 and label = btrim(label)
           and label !~ '[[:cntrl:]]' and label !~ '<[A-Za-z/!?]'),
  -- https only, lowercase host, no credentials or port, no quotes/spaces/brackets.
  url text not null
    constraint community_links_url_check
    check (char_length(url) <= 500
           and url ~ '^https://[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s"''<>\\]*)?$'),
  blurb text not null default ''
    constraint community_links_blurb_check
    check (char_length(blurb) <= 80 and blurb = btrim(blurb)
           and blurb !~ '[[:cntrl:]]' and blurb !~ '<[A-Za-z/!?]'),
  visible boolean not null default true
);

create unique index community_links_position on public.community_links (position);

-------------------------------------------------------------------------------
-- Join page FAQ
-------------------------------------------------------------------------------
create table public.join_faq (
  id uuid primary key default gen_random_uuid(),
  position int not null constraint join_faq_position_check check (position >= 0),
  question text not null
    constraint join_faq_question_check
    check (char_length(question) between 1 and 150 and question = btrim(question)
           and question !~ '[[:cntrl:]]' and question !~ '<[A-Za-z/!?]'),
  answer text not null
    constraint join_faq_answer_check
    check (char_length(answer) between 1 and 600 and answer = btrim(answer)
           and answer !~ '[[:cntrl:]]' and answer !~ '<[A-Za-z/!?]')
);

create unique index join_faq_position on public.join_faq (position);

-------------------------------------------------------------------------------
-- "What we do" cards: fixed set (each has an icon), editable words.
-------------------------------------------------------------------------------
create table public.join_what_we_do (
  key text primary key
    constraint join_what_we_do_key_check check (key in ('game_night', 'social', 'game_jam', 'workshop')),
  position int not null unique,
  title text not null
    constraint join_what_we_do_title_check
    check (char_length(title) between 1 and 40 and title = btrim(title)
           and title !~ '[[:cntrl:]]' and title !~ '<[A-Za-z/!?]'),
  body text not null
    constraint join_what_we_do_body_check
    check (char_length(body) between 1 and 200 and body = btrim(body)
           and body !~ '[[:cntrl:]]' and body !~ '<[A-Za-z/!?]')
);

-------------------------------------------------------------------------------
-- Featured panel (home page): exactly one row.
-------------------------------------------------------------------------------
create table public.featured_panel (
  id boolean primary key default true constraint featured_panel_single check (id),
  enabled boolean not null default true,
  title text not null
    constraint featured_panel_title_check
    check (char_length(title) between 1 and 80 and title = btrim(title)
           and title !~ '[[:cntrl:]]' and title !~ '<[A-Za-z/!?]'),
  body text not null
    constraint featured_panel_body_check
    check (char_length(body) between 1 and 300 and body = btrim(body)
           and body !~ '[[:cntrl:]]' and body !~ '<[A-Za-z/!?]'),
  link_text text
    constraint featured_panel_link_text_check
    check (link_text is null or (char_length(link_text) between 1 and 40 and link_text = btrim(link_text)
           and link_text !~ '[[:cntrl:]]' and link_text !~ '<[A-Za-z/!?]')),
  -- A path on our own site (no "//host", no dot segments, which could turn a
  -- path into another host), or an https link.
  link_href text
    constraint featured_panel_link_href_check
    check (link_href is null or (
      char_length(link_href) <= 500
      and (
        (link_href ~ '^/([^/\\\s"''<>][^\s"''<>\\]*)?$' and link_href !~* '(^|/)(\.|%2e){1,2}(/|[?#]|$)')
        or link_href ~ '^https://[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s"''<>\\]*)?$'
      )
    )),
  constraint featured_panel_link_pair check ((link_text is null) = (link_href is null))
);

-------------------------------------------------------------------------------
-- Seed: the content as it is on the site today.
-------------------------------------------------------------------------------
insert into public.community_links (position, label, url, blurb) values
  (0, 'Instagram',    'https://www.instagram.com/michiganrobloxclub',       'Photos and event announcements'),
  (1, 'GroupMe',      'https://groupme.com/join_group/110761275/29bjlQWA',   'Quick updates and chat'),
  (2, 'Discord',      'https://discord.gg/83Xtc9TJtA',                       'Hang out, find teammates, play together'),
  (3, 'Roblox Group', 'https://www.roblox.com/share/g/498559567',            'Join the club group on Roblox'),
  (4, 'LinkedIn',     'https://www.linkedin.com/company/roblox-at-um',       'Club news and opportunities'),
  (5, 'Maize Pages',  'https://maizepages.umich.edu/organization/roblox-at-um', 'Our official U-M student org page');

insert into public.join_faq (position, question, answer) values
  (0, 'Does it cost anything?', 'No. Membership and events are free.'),
  (1, 'Do I need experience?', 'None at all. Plenty of members have never opened Roblox Studio. Bring a laptop if you have one.'),
  (2, 'When and where do you meet?', 'It changes with each event. The next one is listed at the top of this page, and every event is on our Events page.'),
  (3, 'Who can join?', 'Any U-M student. Sign up with your umich.edu Google account.');

insert into public.join_what_we_do (key, position, title, body) values
  ('game_night', 0, 'Game Nights', 'Play popular Roblox games together with the community.'),
  ('social',     1, 'Community',   'Hang out and meet other Roblox fans at U-M.'),
  ('game_jam',   2, 'Game Jams',   'Team up with friends and build a game together.'),
  ('workshop',   3, 'Workshops',   'Want to make games? Optional sessions on scripting and building, no experience needed.');

insert into public.featured_panel (enabled, title, body, link_text, link_href) values
  (true, '72-hour Game Jam with Roblox',
   'Teams spent three days building games together, start to finish. Jams are the best way to learn fast and make something real.',
   'Be part of the next one', '/join');

-------------------------------------------------------------------------------
-- Who edited last (officers only)
-------------------------------------------------------------------------------
create table public.site_content_edits (
  section text primary key
    constraint site_content_edits_section_check check (section in ('links', 'join', 'featured')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- Row-level, so it only fires for rows that really changed: an update or
-- delete that RLS blocks (0 rows) records nothing. Whoever is signed in is
-- the editor (auth.uid(); null for changes made in SQL).
create or replace function private.record_content_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.site_content_edits (section, updated_at, updated_by)
  values (tg_argv[0], now(), (select auth.uid()))
  on conflict (section) do update set updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return null;
end;
$$;

revoke execute on function private.record_content_edit() from public, anon, authenticated;

-- After the seed, so the original content has no "edited by".
create trigger community_links_record_edit after insert or update or delete on public.community_links
  for each row execute function private.record_content_edit('links');
create trigger join_faq_record_edit after insert or update or delete on public.join_faq
  for each row execute function private.record_content_edit('join');
create trigger join_what_we_do_record_edit after insert or update or delete on public.join_what_we_do
  for each row execute function private.record_content_edit('join');
create trigger featured_panel_record_edit after insert or update or delete on public.featured_panel
  for each row execute function private.record_content_edit('featured');

-------------------------------------------------------------------------------
-- Grants and RLS
-------------------------------------------------------------------------------
alter table public.community_links enable row level security;
alter table public.join_faq enable row level security;
alter table public.join_what_we_do enable row level security;
alter table public.featured_panel enable row level security;
alter table public.site_content_edits enable row level security;

revoke all on public.community_links, public.join_faq, public.join_what_we_do, public.featured_panel,
  public.site_content_edits from anon, authenticated;

grant select on public.community_links, public.join_faq, public.join_what_we_do, public.featured_panel
  to anon, authenticated;
-- Officers write through the save_* functions (security invoker, so RLS applies).
grant insert, delete on public.community_links, public.join_faq to authenticated;
grant update (title, body) on public.join_what_we_do to authenticated;
grant update (enabled, title, body, link_text, link_href) on public.featured_panel to authenticated;
grant select on public.site_content_edits to authenticated;

create policy "Anyone reads shown links; officers read all"
  on public.community_links for select to anon, authenticated
  using (visible or (select private.is_officer()));
create policy "Officers add links"
  on public.community_links for insert to authenticated
  with check ((select private.is_officer()));
create policy "Officers remove links"
  on public.community_links for delete to authenticated
  using ((select private.is_officer()));

create policy "Anyone reads the FAQ"
  on public.join_faq for select to anon, authenticated using (true);
create policy "Officers add FAQ questions"
  on public.join_faq for insert to authenticated
  with check ((select private.is_officer()));
create policy "Officers remove FAQ questions"
  on public.join_faq for delete to authenticated
  using ((select private.is_officer()));

create policy "Anyone reads what we do"
  on public.join_what_we_do for select to anon, authenticated using (true);
create policy "Officers edit what we do"
  on public.join_what_we_do for update to authenticated
  using ((select private.is_officer()))
  with check ((select private.is_officer()));

create policy "Anyone reads the featured panel"
  on public.featured_panel for select to anon, authenticated using (true);
create policy "Officers edit the featured panel"
  on public.featured_panel for update to authenticated
  using ((select private.is_officer()))
  with check ((select private.is_officer()));

create policy "Officers read who edited site content"
  on public.site_content_edits for select to authenticated
  using ((select private.is_officer()));

-------------------------------------------------------------------------------
-- Saving. Each takes p_expected: the section's last-edited time when the
-- officer opened the page (null = never edited). If someone saved since, it
-- raises 40001 instead of overwriting their changes.
-------------------------------------------------------------------------------
create or replace function private.check_content_version(p_section text, p_expected timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('site_content:' || p_section));
  if (select updated_at from public.site_content_edits where section = p_section) is distinct from p_expected then
    raise exception 'Someone else saved this section since you opened it' using errcode = '40001';
  end if;
end;
$$;

revoke execute on function private.check_content_version(text, timestamptz) from public, anon, authenticated;
grant execute on function private.check_content_version(text, timestamptz) to authenticated;

-- p_links: [{label, url, blurb, visible}, ...] in display order.
create or replace function public.save_community_links(p_expected timestamptz, p_links jsonb)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if not private.is_officer() then
    raise exception 'Officers only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links) > 12 then
    raise exception 'Up to 12 links' using errcode = '22023';
  end if;
  perform private.check_content_version('links', p_expected);

  delete from public.community_links where true;
  insert into public.community_links (position, label, url, blurb, visible)
  select (e.n - 1)::int, e.v->>'label', e.v->>'url', coalesce(e.v->>'blurb', ''), coalesce((e.v->'visible')::boolean, true)
    from jsonb_array_elements(p_links) with ordinality as e(v, n);

  return (select updated_at from public.site_content_edits where section = 'links');
end;
$$;

-- p_faq: [{question, answer}, ...] in order. p_what: [{key, title, body}] for all four cards.
create or replace function public.save_join_content(p_expected timestamptz, p_faq jsonb, p_what jsonb)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare v_rows int;
begin
  if not private.is_officer() then
    raise exception 'Officers only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_faq) is distinct from 'array' or jsonb_array_length(p_faq) > 20 then
    raise exception 'Up to 20 questions' using errcode = '22023';
  end if;
  if jsonb_typeof(p_what) is distinct from 'array'
     or (select count(distinct k) from jsonb_array_elements(p_what) e, lateral (select e->>'key' as k) s
          where k in ('game_night', 'social', 'game_jam', 'workshop')) <> 4
     or jsonb_array_length(p_what) <> 4 then
    raise exception 'All four "What we do" cards are needed' using errcode = '22023';
  end if;
  perform private.check_content_version('join', p_expected);

  delete from public.join_faq where true;
  insert into public.join_faq (position, question, answer)
  select (e.n - 1)::int, e.v->>'question', e.v->>'answer'
    from jsonb_array_elements(p_faq) with ordinality as e(v, n);

  update public.join_what_we_do w set title = x.title, body = x.body
    from jsonb_to_recordset(p_what) as x(key text, title text, body text)
   where w.key = x.key;
  get diagnostics v_rows = row_count;
  if v_rows <> 4 then
    raise exception 'Couldn''t update the "What we do" cards' using errcode = '22023';
  end if;

  return (select updated_at from public.site_content_edits where section = 'join');
end;
$$;

create or replace function public.save_featured_panel(
  p_expected timestamptz, p_enabled boolean, p_title text, p_body text, p_link_text text, p_link_href text
)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if not private.is_officer() then
    raise exception 'Officers only' using errcode = '42501';
  end if;
  perform private.check_content_version('featured', p_expected);
  update public.featured_panel
     set enabled = coalesce(p_enabled, false), title = p_title, body = p_body,
         link_text = p_link_text, link_href = p_link_href
   where id;
  return (select updated_at from public.site_content_edits where section = 'featured');
end;
$$;

revoke execute on function public.save_community_links(timestamptz, jsonb) from public, anon;
revoke execute on function public.save_join_content(timestamptz, jsonb, jsonb) from public, anon;
revoke execute on function public.save_featured_panel(timestamptz, boolean, text, text, text, text) from public, anon;
grant execute on function public.save_community_links(timestamptz, jsonb) to authenticated;
grant execute on function public.save_join_content(timestamptz, jsonb, jsonb) to authenticated;
grant execute on function public.save_featured_panel(timestamptz, boolean, text, text, text, text) to authenticated;
