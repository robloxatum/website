-- Roblox avatars: the member's Roblox user ID, looked up from their username
-- when they save it (Roblox's public users API). Only used to fetch their
-- current avatar headshot; the image itself is never stored.
--
-- Same visibility as the rest of the profile: the existing profiles policies
-- let members read only their own row and officers read every row.

alter table public.profiles
  add column roblox_user_id bigint
    constraint profiles_roblox_user_id_check
    -- An ID only makes sense alongside the username it was looked up from.
    check (roblox_user_id is null or (roblox_user_id > 0 and roblox_username is not null));

-- Members save it together with their username (from /profile and /welcome).
-- Like the username, it's self-reported: it only drives the avatar picture.
grant update (roblox_user_id) on public.profiles to authenticated;

-- Officers' members list. New columns must go at the end of a replaced view.
create or replace view public.member_attendance
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
  max(a.checked_in_at) as last_checked_in_at,
  p.roblox_user_id
from public.profiles p
left join public.attendance a on a.user_id = p.id
group by p.id;
