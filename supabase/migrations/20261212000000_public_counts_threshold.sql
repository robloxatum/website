-- Security audit 3, L-3: public_past_event_counts() only returns counts of 10
-- or more, the same rule the site already applies (src/lib/events.ts
-- MIN_PUBLIC_COUNT). Before this, anyone with the public key could call the
-- RPC directly and read the small counts the site hides.
--
-- Same signature and grants, so the app needs no change.

create or replace function public.public_past_event_counts()
returns table (event_id uuid, attendance int)
language sql
stable
security definer
set search_path = ''
as $$
  select a.event_id, count(*)::int
    from public.attendance a
    join public.events e on e.id = a.event_id
   where e.ends_at <= now()
   group by a.event_id
  having count(*) >= 10
$$;

revoke execute on function public.public_past_event_counts() from public;
grant execute on function public.public_past_event_counts() to anon, authenticated;
