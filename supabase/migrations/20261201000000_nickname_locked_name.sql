-- Locked name + optional nickname.
--
-- * full_name now comes only from the member's U-M Google account: members'
--   edits to it are ignored, and it's refreshed from Google's profile data each time
--   they sign in (when Google sends a non-empty name).
-- * nickname (optional) is what the site calls the member. Same visibility as
--   the rest of the profile (the existing profiles policies: members read and
--   edit their own row, officers read every row). Officers can clear an
--   inappropriate one with public.clear_nickname().

-------------------------------------------------------------------------------
-- Name: read-only for members
-------------------------------------------------------------------------------

-- A trigger (not a column revoke) so the site version deployed before this
-- change, which still sends full_name when saving a profile, keeps working:
-- the API roles' changes to full_name are just ignored. Supabase Auth and the
-- sync below run as other roles and still update it.
create or replace function private.keep_full_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.full_name := old.full_name;
  end if;
  return new;
end;
$$;

revoke execute on function private.keep_full_name() from public, anon, authenticated;

create trigger profiles_keep_full_name
  before update of full_name on public.profiles
  for each row execute function private.keep_full_name();

-- Keep the name in step with Google. Supabase Auth rewrites raw_user_meta_data
-- from the identity provider on sign-in.
create or replace function private.sync_full_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    new.raw_user_meta_data ->> 'name',
    ''
  )), 100);
begin
  if v_name <> '' then
    update public.profiles set full_name = v_name where id = new.id and full_name is distinct from v_name;
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_full_name() from public, anon, authenticated;

create trigger on_auth_user_updated_sync_name
  after update of raw_user_meta_data on auth.users
  for each row execute function private.sync_full_name();

-------------------------------------------------------------------------------
-- Nickname
-------------------------------------------------------------------------------

-- 1–30 characters, no leading/trailing spaces, at least one letter or number.
-- Letters are ASCII plus accented Latin letters (À–ÿ, minus × and ÷); the
-- punctuation allowed is . , ' ’ - _ ! ? & ( ). Keep in step with src/lib/names.ts.
alter table public.profiles
  add column nickname text
    constraint profiles_nickname_check check (
      nickname is null or (
        char_length(nickname) between 1 and 30
        and nickname = btrim(nickname)
        and nickname ~ '^[A-Za-z0-9À-ÖØ-öø-ÿ .,''’!?&()_-]+$'
        and nickname ~ '[A-Za-z0-9À-ÖØ-öø-ÿ]'
      )
    );

grant update (nickname) on public.profiles to authenticated;

-- Officers clear a member's nickname (e.g. an inappropriate one). They can't
-- set one: members choose their own.
create or replace function public.clear_nickname(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_officer() then
    raise exception 'Only officers can clear nicknames' using errcode = '42501';
  end if;
  update public.profiles set nickname = null where id = p_user_id;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.clear_nickname(uuid) from public, anon;
grant execute on function public.clear_nickname(uuid) to authenticated;

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
  p.roblox_user_id,
  p.nickname
from public.profiles p
left join public.attendance a on a.user_id = p.id
group by p.id;
