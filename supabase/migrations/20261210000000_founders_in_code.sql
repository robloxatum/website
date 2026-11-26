-- The founders on /about now live in the site's code (src/content/founders.ts),
-- not the database. /officer/content keeps editing the story and the timeline.
-- Drops public.about_people and replaces save_about_page() with a version
-- without people (same checks otherwise).

drop function if exists public.save_about_page(timestamptz, text, jsonb, jsonb);
drop table if exists public.about_people;

create or replace function public.save_about_page(p_expected timestamptz, p_story text, p_timeline jsonb)
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

  return (select updated_at from public.site_content_edits where section = 'about');
end;
$$;

revoke execute on function public.save_about_page(timestamptz, text, jsonb) from public, anon;
grant execute on function public.save_about_page(timestamptz, text, jsonb) to authenticated;
