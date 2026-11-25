-- The About page (/about, "Our story"), edited on /officer/content like the
-- rest of the site content (see 20261205000000_site_content.sql for the rules):
--   * about_story      the story paragraph (one row)
--   * about_timeline   milestones: date label, title, short text, in order
--   * about_people     founders: name, role, Roblox username (+ looked-up ID),
--                      one-liner, shown or hidden, in order
--
-- Anyone reads it (hidden people only by officers); only officers change it,
-- through save_about_page(), which replaces everything in one transaction and
-- refuses to overwrite an edit made since the officer loaded the page.
-- Plain text: trimmed, single-line, no control characters, nothing tag-like.

create table public.about_story (
  id boolean primary key default true constraint about_story_single check (id),
  body text not null
    constraint about_story_body_check
    check (char_length(body) between 1 and 1200 and body = btrim(body)
           and body !~ '[[:cntrl:]]' and body !~ '<[A-Za-z/!?]')
);

create table public.about_timeline (
  id uuid primary key default gen_random_uuid(),
  position int not null constraint about_timeline_position_check check (position >= 0),
  -- Free-form, e.g. "Oct 2025" or "Winter 2026".
  date_label text not null
    constraint about_timeline_date_check
    check (char_length(date_label) between 1 and 24 and date_label = btrim(date_label)
           and date_label !~ '[[:cntrl:]]' and date_label !~ '<[A-Za-z/!?]'),
  title text not null
    constraint about_timeline_title_check
    check (char_length(title) between 1 and 80 and title = btrim(title)
           and title !~ '[[:cntrl:]]' and title !~ '<[A-Za-z/!?]'),
  body text not null default ''
    constraint about_timeline_body_check
    check (char_length(body) <= 240 and body = btrim(body)
           and body !~ '[[:cntrl:]]' and body !~ '<[A-Za-z/!?]')
);

create unique index about_timeline_position on public.about_timeline (position);

create table public.about_people (
  id uuid primary key default gen_random_uuid(),
  position int not null constraint about_people_position_check check (position >= 0),
  name text not null
    constraint about_people_name_check
    check (char_length(name) between 1 and 60 and name = btrim(name)
           and name !~ '[[:cntrl:]]' and name !~ '<[A-Za-z/!?]'),
  role text not null
    constraint about_people_role_check
    check (char_length(role) between 1 and 40 and role = btrim(role)
           and role !~ '[[:cntrl:]]' and role !~ '<[A-Za-z/!?]'),
  -- Same rule as profiles.roblox_username; the ID is looked up by the server on save.
  roblox_username text
    constraint about_people_roblox_username_check
    check (roblox_username is null or roblox_username ~ '^[A-Za-z0-9_]{3,20}$'),
  roblox_user_id bigint constraint about_people_roblox_user_id_check check (roblox_user_id is null or roblox_user_id > 0),
  blurb text not null default ''
    constraint about_people_blurb_check
    check (char_length(blurb) <= 120 and blurb = btrim(blurb)
           and blurb !~ '[[:cntrl:]]' and blurb !~ '<[A-Za-z/!?]'),
  visible boolean not null default true,
  constraint about_people_id_needs_username check (roblox_user_id is null or roblox_username is not null)
);

create unique index about_people_position on public.about_people (position);

-------------------------------------------------------------------------------
-- Seed: placeholders the officers fill in.
-------------------------------------------------------------------------------
insert into public.about_story (body) values
  ('Roblox at UM started in October 2025, when a few students who loved playing and building on Roblox decided U-M needed a place to do it together. Our story is just getting started.');

insert into public.about_timeline (position, date_label, title, body) values
  (0, 'Oct 2025', 'Roblox at UM founded', '');

-------------------------------------------------------------------------------
-- Who edited last: a new 'about' section.
-------------------------------------------------------------------------------
alter table public.site_content_edits drop constraint site_content_edits_section_check;
alter table public.site_content_edits add constraint site_content_edits_section_check
  check (section in ('links', 'join', 'featured', 'about'));

-- After the seed, so the placeholders have no "edited by".
create trigger about_story_record_edit after insert or update or delete on public.about_story
  for each row execute function private.record_content_edit('about');
create trigger about_timeline_record_edit after insert or update or delete on public.about_timeline
  for each row execute function private.record_content_edit('about');
create trigger about_people_record_edit after insert or update or delete on public.about_people
  for each row execute function private.record_content_edit('about');

-------------------------------------------------------------------------------
-- Grants and RLS
-------------------------------------------------------------------------------
alter table public.about_story enable row level security;
alter table public.about_timeline enable row level security;
alter table public.about_people enable row level security;

revoke all on public.about_story, public.about_timeline, public.about_people from anon, authenticated;
grant select on public.about_story, public.about_timeline, public.about_people to anon, authenticated;
-- Officers write through save_about_page() (security invoker, so RLS applies).
grant update (body) on public.about_story to authenticated;
grant insert, delete on public.about_timeline, public.about_people to authenticated;

create policy "Anyone reads the story"
  on public.about_story for select to anon, authenticated using (true);
create policy "Officers edit the story"
  on public.about_story for update to authenticated
  using ((select private.is_officer()))
  with check ((select private.is_officer()));

create policy "Anyone reads the timeline"
  on public.about_timeline for select to anon, authenticated using (true);
create policy "Officers add timeline items"
  on public.about_timeline for insert to authenticated
  with check ((select private.is_officer()));
create policy "Officers remove timeline items"
  on public.about_timeline for delete to authenticated
  using ((select private.is_officer()));

create policy "Anyone reads shown people; officers read all"
  on public.about_people for select to anon, authenticated
  using (visible or (select private.is_officer()));
create policy "Officers add people"
  on public.about_people for insert to authenticated
  with check ((select private.is_officer()));
create policy "Officers remove people"
  on public.about_people for delete to authenticated
  using ((select private.is_officer()));

-------------------------------------------------------------------------------
-- Saving: everything at once.
--   p_timeline: [{date_label, title, body}, ...] in order (up to 30)
--   p_people:   [{name, role, roblox_username, roblox_user_id, blurb, visible}, ...] in order (up to 24)
-------------------------------------------------------------------------------
create or replace function public.save_about_page(p_expected timestamptz, p_story text, p_timeline jsonb, p_people jsonb)
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
  if jsonb_typeof(p_timeline) is distinct from 'array' or jsonb_array_length(p_timeline) > 30 then
    raise exception 'Up to 30 timeline items' using errcode = '22023';
  end if;
  if jsonb_typeof(p_people) is distinct from 'array' or jsonb_array_length(p_people) > 24 then
    raise exception 'Up to 24 people' using errcode = '22023';
  end if;
  perform private.check_content_version('about', p_expected);

  update public.about_story set body = p_story where id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Couldn''t update the story' using errcode = '22023';
  end if;

  delete from public.about_timeline where true;
  insert into public.about_timeline (position, date_label, title, body)
  select (e.n - 1)::int, e.v->>'date_label', e.v->>'title', coalesce(e.v->>'body', '')
    from jsonb_array_elements(p_timeline) with ordinality as e(v, n);

  delete from public.about_people where true;
  insert into public.about_people (position, name, role, roblox_username, roblox_user_id, blurb, visible)
  select (e.n - 1)::int, e.v->>'name', e.v->>'role', nullif(e.v->>'roblox_username', ''),
         (e.v->>'roblox_user_id')::bigint, coalesce(e.v->>'blurb', ''), coalesce((e.v->'visible')::boolean, true)
    from jsonb_array_elements(p_people) with ordinality as e(v, n);

  return (select updated_at from public.site_content_edits where section = 'about');
end;
$$;

revoke execute on function public.save_about_page(timestamptz, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_about_page(timestamptz, text, jsonb, jsonb) to authenticated;
