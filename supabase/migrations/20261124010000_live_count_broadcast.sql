-- Live check-in count via Realtime Broadcast instead of Postgres Changes.
--
-- Why: Postgres Changes can't filter DELETE events (without REPLICA IDENTITY
-- FULL) and doesn't apply RLS to them, so the present page missed removals,
-- and full replica identity would let any signed-in member who subscribes see
-- other people's removed check-ins. Instead, a trigger broadcasts only the new
-- count for the event on a private channel that only officers may join.

alter publication supabase_realtime drop table public.attendance;

create or replace function private.broadcast_attendance_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid := coalesce(new.event_id, old.event_id);
  v_count int;
begin
  select count(*) into v_count from public.attendance where event_id = v_event_id;
  begin
    perform realtime.send(
      jsonb_build_object('count', v_count), -- payload: the count only, no member data
      'count',                              -- event
      'attendance:' || v_event_id::text,    -- topic
      true                                  -- private channel
    );
  exception when others then
    -- A live-count hiccup must never block a check-in or a removal.
    raise warning 'broadcast_attendance_count failed: %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function private.broadcast_attendance_count() from public, anon, authenticated;

create trigger attendance_broadcast_count
  after insert or delete on public.attendance
  for each row execute function private.broadcast_attendance_count();

-- Only officers can receive messages on attendance:* topics.
create policy "Officers receive live attendance counts"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) like 'attendance:%'
    and (select private.is_officer())
  );
