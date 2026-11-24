-- Owner role, above Officer.
--
-- * Only owners can make or remove officers (public.set_officer checks it).
-- * Owners are always officers too (constraint), so every officer permission
--   (private.is_officer()) applies to them unchanged.
-- * There's no API path that changes is_owner: members can't update the column
--   (no column grant) and no function sets it. Owners are set only by running
--   SQL in Supabase. Who the owners are is deliberately NOT in this file.
-- * Owners can't be removed as officers from the site, and the last owner can
--   never be demoted or deleted (trigger, which applies to SQL too).

alter table public.profiles
  add column is_owner boolean not null default false,
  add constraint profiles_owner_is_officer check (not is_owner or is_officer);

-- True when the caller is an owner (and a signed-in umich.edu user).
create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_owner and p.is_officer from public.profiles p where p.id = (select auth.uid())),
    false
  ) and private.is_umich()
$$;

revoke execute on function private.is_owner() from public, anon, authenticated;

-- The last owner can't stop being an owner (or an officer), or be deleted.
create or replace function private.keep_last_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_owner
     and (tg_op = 'DELETE' or not new.is_owner or not new.is_officer)
     and not exists (select 1 from public.profiles where is_owner and id <> old.id)
  then
    raise exception 'You can''t demote the last owner' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function private.keep_last_owner() from public, anon, authenticated;

create trigger profiles_keep_last_owner
  before update of is_owner, is_officer or delete on public.profiles
  for each row execute function private.keep_last_owner();

-- Make or remove an officer: owners only. Owners themselves can't be removed
-- here. Same advisory lock and last-officer rule as before.
create or replace function public.set_officer(p_user_id uuid, p_is_officer boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.set_officer'));

  if not private.is_owner() then
    raise exception 'Only owners can change officer status' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  if not p_is_officer and exists (select 1 from public.profiles where id = p_user_id and is_owner) then
    raise exception 'Owners can''t be removed as officers' using errcode = 'P0001';
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
  p.nickname,
  p.is_owner
from public.profiles p
left join public.attendance a on a.user_id = p.id
group by p.id;
