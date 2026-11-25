-- Security review: don't expose which officer created an event or announcement.
--
-- events.created_by: hidden from signed-out visitors (anon). Signed-in users
-- keep table-level SELECT because officer queries use the computed column
-- public.checkin_is_open(events), and a whole-row reference needs SELECT on
-- every column. Nothing in the app reads created_by.
--
-- announcements.created_by: hidden from everyone using the API.
--
-- Column grants: a column added later is NOT readable by anon/authenticated
-- until it's granted here too.

revoke select on public.events from anon;
grant select (
  id, title, description, location, starts_at, ends_at,
  checkin_open, checkin_reopened, created_at, updated_at,
  category, capacity,
  flyer_path, flyer_width, flyer_height,
  cover_path, cover_width, cover_height
) on public.events to anon;

revoke select on public.announcements from anon, authenticated;
grant select (id, message, link, style, hide_after, created_at) on public.announcements to anon, authenticated;
