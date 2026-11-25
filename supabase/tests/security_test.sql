-- Security tests for the Roblox at UM schema.
--
-- Runs entirely inside one transaction and ROLLS BACK at the end, so it leaves
-- no data behind. Any failed check raises an exception and aborts the run; if
-- you see "ALL SECURITY TESTS PASSED", every check passed.
--
--   npx supabase db query --linked -f supabase/tests/security_test.sql

begin;

-- Test users. Inserting into auth.users fires the profile trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'officer@umich.edu', '{"full_name":"Olivia Officer"}'),
  ('00000000-0000-0000-0000-00000000000b', 'member@umich.edu',  '{"full_name":"Max Member"}'),
  ('00000000-0000-0000-0000-00000000000c', 'newbie@umich.edu',  '{"name":"Nora Newbie"}'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider@gmail.com', '{}');

do $$ begin
  assert (select count(*) from public.profiles where id::text like '00000000-0000-0000-0000-00000000000%') = 3,
    'profiles are created for umich.edu users only';
  assert (select uniqname from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'member',
    'uniqname comes from the email';
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'Nora Newbie',
    'name falls back to the "name" claim';
  assert (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = false,
    'new members are not officers';
  assert public.hook_umich_only('{"user":{"email":"Someone@UMICH.EDU"}}') = '{}'::jsonb,
    'hook allows umich.edu (any case)';
  assert public.hook_umich_only('{"user":{"email":"someone@gmail.com"}}') ? 'error',
    'hook rejects other domains';
  assert public.hook_umich_only('{"user":{"email":"someone@fakeumich.edu"}}') ? 'error',
    'hook rejects look-alike domains';
end $$;

-- Inside this rolled-back transaction only: make the test officer the sole
-- officer and owner, so the "last officer/owner" rules can be tested on a live
-- database too. (Owner first, so real owners can then be demoted.)
update public.profiles set is_officer = true, is_owner = true where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_owner = false where is_owner and id <> '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_officer = false where is_officer and id <> '00000000-0000-0000-0000-00000000000a';

-------------------------------------------------------------------------------
-- Officer creates events
-------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_id uuid; v_code text;
begin
  insert into public.events (title, starts_at, ends_at)
  values ('Game Jam Kickoff', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_id;
  perform set_config('test.e1', v_id::text, true);

  select code into v_code from public.event_codes where event_id = v_id;
  assert v_code ~ '^[A-HJ-NP-Z]{5}$', 'officer sees a 5-letter code without I or O';
  perform set_config('test.code1', v_code, true);

  insert into public.events (title, starts_at, ends_at)
  values ('Last Week Meeting', now() - interval '3 hours', now() - interval '1 hour')
  returning id into v_id;
  perform set_config('test.e2', v_id::text, true);
  perform set_config('test.code2', (select code from public.event_codes where event_id = v_id), true);

  assert public.set_checkin_open(current_setting('test.e1')::uuid, true) = true,
    'officer opens check-in';
  assert (select created_by from public.events where id = v_id) = '00000000-0000-0000-0000-00000000000a',
    'created_by defaults to the officer';

  begin
    insert into public.events (title, starts_at, ends_at, category)
    values ('Bad category', now(), now() + interval '1 hour', 'rave');
    raise exception 'FAIL: invalid category accepted';
  exception when check_violation then null; end;
  begin
    insert into public.events (title, starts_at, ends_at, capacity)
    values ('Bad capacity', now(), now() + interval '1 hour', 0);
    raise exception 'FAIL: zero capacity accepted';
  exception when check_violation then null; end;
  update public.events set category = 'partner', capacity = 40
   where id = current_setting('test.e1')::uuid;
  assert (select category from public.events where id = current_setting('test.e1')::uuid) = 'partner',
    'officers can set a category (including Partner Event)';
  assert (select category from public.events where id = current_setting('test.e2')::uuid) = 'meeting',
    'category defaults to meeting';

  v_code := public.regenerate_event_code(current_setting('test.e1')::uuid);
  assert v_code ~ '^[A-HJ-NP-Z]{5}$', 'officer can regenerate a code';
  perform set_config('test.code1', v_code, true);
end $$;

reset role;

-------------------------------------------------------------------------------
-- Member: can't read codes, can't escalate, can check in exactly once
-------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_result jsonb; v_rows int;
begin
  assert (select count(*) from public.event_codes) = 0, 'member cannot read any event code';
  assert (select count(*) from public.events where id::text in (current_setting('test.e1'), current_setting('test.e2'))) = 2, 'member can read events';
  assert (select count(*) from public.profiles) = 1, 'member reads only their own profile';

  begin
    insert into public.events (title, starts_at, ends_at) values ('Hack', now(), now() + interval '1 hour');
    raise exception 'FAIL: member created an event';
  exception when insufficient_privilege then null; end;

  begin
    update public.events set title = 'pwned';
    get diagnostics v_rows = row_count;
    assert v_rows = 0, 'member cannot update events';
  exception when insufficient_privilege then null; end;

  begin
    update public.profiles set is_officer = true where id = auth.uid();
    raise exception 'FAIL: member made themselves an officer';
  exception when insufficient_privilege then null; end;

  begin
    update public.profiles set uniqname = 'officer2' where id = auth.uid();
    raise exception 'FAIL: member changed their uniqname';
  exception when insufficient_privilege then null; end;

  update public.profiles set roblox_username = 'Max_Builds' where id = auth.uid();
  assert (select roblox_username from public.profiles where id = auth.uid()) = 'Max_Builds',
    'member can edit their own Roblox username';

  update public.profiles set roblox_username = 'Hacked' where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'member cannot edit someone else''s profile';

  begin
    insert into public.attendance (event_id, user_id) values (current_setting('test.e1')::uuid, auth.uid());
    raise exception 'FAIL: member inserted attendance directly';
  exception when insufficient_privilege then null; end;

  begin
    perform public.set_officer(auth.uid(), true);
    raise exception 'FAIL: member called set_officer';
  exception when insufficient_privilege then null; end;

  begin
    perform public.regenerate_event_code(current_setting('test.e1')::uuid);
    raise exception 'FAIL: member regenerated a code';
  exception when insufficient_privilege then null; end;

  begin
    perform public.set_checkin_open(current_setting('test.e1')::uuid, false);
    raise exception 'FAIL: member toggled check-in';
  exception when insufficient_privilege then null; end;

  v_result := public.check_in('ZZZZZ');
  if current_setting('test.code1') = 'ZZZZZ' then v_result := public.check_in('YYYYY'); end if;
  assert v_result ->> 'status' = 'invalid_code', 'wrong code is rejected';
  assert v_result ->> 'event_title' is null, 'wrong code reveals nothing';

  v_result := public.check_in('IOIOI');
  assert v_result ->> 'status' = 'invalid_code', 'malformed code is rejected';

  v_result := public.check_in(' ' || lower(current_setting('test.code1')) || ' ');
  assert v_result ->> 'status' = 'ok', 'correct code checks in (case and spaces ignored)';
  assert v_result ->> 'event_title' = 'Game Jam Kickoff', 'check-in returns the event title';
  assert not (v_result ? 'code'), 'check-in never returns a code';
  assert v_result -> 'event' ->> 'id' = current_setting('test.e1'), 'check-in returns the event id';
  assert v_result -> 'event' ->> 'category' = 'partner', 'check-in returns the event category';
  assert v_result -> 'event' ? 'starts_at' and v_result -> 'event' ? 'location', 'check-in returns date and place';
  assert position(current_setting('test.code1') in v_result::text) = 0, 'the code appears nowhere in the result';

  v_result := public.check_in(current_setting('test.code1'));
  assert v_result ->> 'status' = 'already_checked_in', 'second check-in is refused';

  assert (select count(*) from public.attendance) = 1, 'member sees only their own attendance';

  delete from public.attendance;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'member cannot delete attendance';

  assert (select count(*) from public.member_attendance) = 1, 'member sees only their own totals row';
  assert (select total_attendance from public.member_attendance) = 1, 'member total is 1';
end $$;

reset role;

-------------------------------------------------------------------------------
-- Closed check-in and auto-close at the end time
-------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert public.set_checkin_open(current_setting('test.e1')::uuid, false) = false, 'officer closes check-in';
  -- Event 2 was opened before it ended (no manual reopen), so it auto-closed.
  update public.events set checkin_open = true, checkin_reopened = false
   where id = current_setting('test.e2')::uuid;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_result jsonb;
begin
  v_result := public.check_in(current_setting('test.code1'));
  assert v_result ->> 'status' = 'closed', 'closed check-in is refused';
  v_result := public.check_in(current_setting('test.code2'));
  assert v_result ->> 'status' = 'closed', 'check-in auto-closes at the end time';
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert public.set_checkin_open(current_setting('test.e2')::uuid, true) = true,
    'officer can reopen check-in after the end time';
  assert (select checkin_reopened from public.events where id = current_setting('test.e2')::uuid),
    'reopen after the end time is recorded';
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_result jsonb; i int;
begin
  v_result := public.check_in(current_setting('test.code2'));
  assert v_result ->> 'status' = 'ok', 'manually reopened check-in works after the end time';

  -- Rate limit: 10 wrong codes in 10 minutes, then everything is refused.
  for i in 1..10 loop
    v_result := public.check_in('QQQQ' || chr(65 + i));
  end loop;
  v_result := public.check_in(current_setting('test.code1'));
  assert v_result ->> 'status' = 'rate_limited', 'too many wrong codes are rate limited';
end $$;
reset role;

-------------------------------------------------------------------------------
-- Signed-out visitors and non-umich accounts
-------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = 'public_stats'),
    'site-wide public totals are no longer exposed';
  assert (select attendance from public.public_past_event_counts()
           where event_id = current_setting('test.e2')::uuid) = 1,
    'past events expose an aggregate attendance count';
  assert not exists (select 1 from public.public_past_event_counts()
                      where event_id = current_setting('test.e1')::uuid),
    'live/upcoming events never expose attendance counts';
  assert (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'events' and column_name = 'capacity') = 1,
    'capacity column exists';
  assert (select count(*) from public.events) >= 2, 'anyone can read events';
  begin
    perform count(*) from public.event_codes;
    raise exception 'FAIL: anon read event codes';
  exception when insufficient_privilege then null; end;
  begin
    perform public.check_in('ABCDE');
    raise exception 'FAIL: anon called check_in';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from public.profiles;
    raise exception 'FAIL: anon read profiles';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from public.attendance;
    raise exception 'FAIL: anon read attendance';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000d","email":"outsider@gmail.com","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert public.check_in(current_setting('test.code1')) ->> 'status' = 'not_umich',
    'non-umich accounts cannot check in';
end $$;
reset role;

-------------------------------------------------------------------------------
-- Officer management: owners only. a is the owner (and only officer) here.
-------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.set_officer('00000000-0000-0000-0000-00000000000b', true);
  assert (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
    'an owner can make someone an officer';
  assert (select count(*) from public.profiles where id::text like '00000000-0000-0000-0000-00000000000_') = 3, 'officer reads all profiles';
  assert (select count(*) from public.attendance where event_id::text in (current_setting('test.e1'), current_setting('test.e2'))) = 2, 'officer reads all attendance';
  assert (select is_owner from public.member_attendance where id = auth.uid()), 'owners show in the members view';

  begin
    perform public.set_officer(auth.uid(), false);
    raise exception 'FAIL: owner removed as an officer';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    update public.profiles set is_owner = false where id = auth.uid();
    raise exception 'FAIL: owner changed is_owner through the API';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- b: an officer, not an owner. Keeps every officer permission but can't
-- make or remove officers, or make themselves an owner.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.event_codes where event_id::text in (current_setting('test.e1'), current_setting('test.e2'))) = 2, 'a promoted officer can read codes';
  begin
    perform public.set_officer('00000000-0000-0000-0000-00000000000c', true);
    raise exception 'FAIL: officer made someone an officer';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_officer('00000000-0000-0000-0000-00000000000a', false);
    raise exception 'FAIL: officer removed an owner';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_officer(auth.uid(), false);
    raise exception 'FAIL: officer removed an officer';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set is_owner = true where id = auth.uid();
    raise exception 'FAIL: officer made themselves an owner';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert not (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
    'officers'' set_officer calls changed nothing';
  assert (select is_officer and is_owner from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
    'the owner is still an owner and officer';
end $$;

-- Owners are set only with SQL. The last owner can never be demoted or deleted.
do $$ begin
  begin
    update public.profiles set is_owner = false where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: demoted the last owner';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    delete from public.profiles where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: deleted the last owner';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    update public.profiles set is_owner = true where id = '00000000-0000-0000-0000-00000000000c';
    raise exception 'FAIL: owner who isn''t an officer';
  exception when check_violation then null; end;
end $$;
-- Hand ownership from a to b (as SQL in Supabase would).
update public.profiles set is_owner = true where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set is_owner = false where id = '00000000-0000-0000-0000-00000000000a';

-- b, now the owner: removes a as an officer; can't remove themselves.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.set_officer('00000000-0000-0000-0000-00000000000a', false);
  assert not (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
    'an owner can remove an officer';
  begin
    perform public.set_officer('00000000-0000-0000-0000-00000000000b', false);
    raise exception 'FAIL: removed the last officer/owner';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  assert (select is_officer from public.profiles where id = auth.uid()), 'last officer is still an officer';
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.event_codes) = 0, 'a removed officer can no longer read codes';
end $$;
reset role;

-------------------------------------------------------------------------------
-- Live count broadcasts (officers only, count only)
-------------------------------------------------------------------------------
do $$
declare v_payload jsonb;
begin
  select payload into v_payload from realtime.messages
   where topic = 'attendance:' || current_setting('test.e1') and event = 'count'
   order by inserted_at desc, id desc limit 1;
  assert (v_payload ->> 'count')::int = 1, 'a check-in broadcasts the new count';
  assert not (v_payload ?| array['user_id', 'uniqname', 'full_name']), 'broadcast carries no member data';
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_payload jsonb;
begin
  -- b is the remaining officer at this point.
  delete from public.attendance
   where event_id = current_setting('test.e2')::uuid
     and user_id = '00000000-0000-0000-0000-00000000000c';
  perform set_config('realtime.topic', 'attendance:' || current_setting('test.e2'), true);
  select payload into v_payload from realtime.messages
   where topic = realtime.topic() order by inserted_at desc, id desc limit 1;
  assert (v_payload ->> 'count')::int = 0, 'removing a check-in broadcasts the new count, and officers can receive it';
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform set_config('realtime.topic', 'attendance:' || current_setting('test.e2'), true);
  assert (select count(*) from realtime.messages where topic = realtime.topic()) = 0,
    'members cannot receive live counts';
end $$;
reset role;

-------------------------------------------------------------------------------
-- Event flyers: events.flyer_* checks and the "event-flyers" Storage policies.
-- Objects are inserted with SQL (as the Storage API does); deletes need
-- storage.allow_delete_query, which Supabase requires for direct SQL deletes.
-------------------------------------------------------------------------------
do $$ begin
  assert (select public and file_size_limit = 5242880 and allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
            from storage.buckets where id = 'event-flyers'),
    'event-flyers bucket is public, 5 MB max, PNG/JPEG/WebP only';
  assert (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
    'flyer tests expect b to be an officer here';
  assert not (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
    'flyer tests expect c to be a member here';
end $$;

-- Officer: upload, list, replace; flyer columns on an event.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_id uuid;
begin
  insert into storage.objects (bucket_id, name) values ('event-flyers', '11111111-1111-4111-8111-111111111111.png');
  assert (select count(*) from storage.objects where bucket_id = 'event-flyers') = 1, 'officers can upload and list flyers';

  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', '../escape.png');
    raise exception 'FAIL: officer uploaded a flyer with a bad name';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', '33333333-3333-4333-8333-333333333333.gif');
    raise exception 'FAIL: officer uploaded a non-PNG/JPG flyer name';
  exception when insufficient_privilege then null; end;

  update storage.objects set name = '22222222-2222-4222-8222-222222222222.jpg'
   where bucket_id = 'event-flyers' and name = '11111111-1111-4111-8111-111111111111.png';
  assert exists (select 1 from storage.objects where name = '22222222-2222-4222-8222-222222222222.jpg'),
    'officers can replace flyers';
  begin
    update storage.objects set name = '../escape.jpg' where name = '22222222-2222-4222-8222-222222222222.jpg';
    raise exception 'FAIL: officer renamed a flyer to a bad name';
  exception when insufficient_privilege then null; end;

  insert into public.events (title, starts_at, ends_at, flyer_path, flyer_width, flyer_height)
  values ('Flyer Night', now() + interval '1 day', now() + interval '1 day 2 hours',
          '22222222-2222-4222-8222-222222222222.jpg', 1080, 1350)
  returning id into v_id;
  perform set_config('test.flyer_event', v_id::text, true);

  begin
    update public.events set flyer_path = '../x.png' where id = v_id;
    raise exception 'FAIL: flyer_path accepted a bad path';
  exception when check_violation then null; end;
  begin
    update public.events set flyer_path = null where id = v_id;
    raise exception 'FAIL: flyer size kept without a flyer';
  exception when check_violation then null; end;
  begin
    update public.events set flyer_width = 0 where id = v_id;
    raise exception 'FAIL: flyer_width accepted 0';
  exception when check_violation then null; end;

  update public.events set flyer_path = null, flyer_width = null, flyer_height = null where id = v_id;
  update public.events set flyer_path = '22222222-2222-4222-8222-222222222222.jpg', flyer_width = 1080, flyer_height = 1350
   where id = v_id;
  assert (select flyer_height from public.events where id = v_id) = 1350, 'officers can set and remove an event flyer';
end $$;
reset role;

-- Member: can see the flyer on the event, but cannot touch Storage or the event.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  assert (select flyer_path from public.events where id = current_setting('test.flyer_event')::uuid)
    = '22222222-2222-4222-8222-222222222222.jpg', 'members can read an event flyer path';
  assert (select count(*) from storage.objects where bucket_id = 'event-flyers') = 0, 'members cannot list flyers';

  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', '44444444-4444-4444-8444-444444444444.png');
    raise exception 'FAIL: member uploaded a flyer';
  exception when insufficient_privilege then null; end;

  update storage.objects set name = '44444444-4444-4444-8444-444444444444.png' where bucket_id = 'event-flyers';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot replace flyers';

  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'event-flyers';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot delete flyers';
  perform set_config('storage.allow_delete_query', 'false', true);

  update public.events set flyer_path = null, flyer_width = null, flyer_height = null
   where id = current_setting('test.flyer_event')::uuid;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot remove an event flyer';
end $$;
reset role;

-- Anonymous: same, read-only.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare v_rows int;
begin
  assert (select flyer_path from public.events where id = current_setting('test.flyer_event')::uuid)
    = '22222222-2222-4222-8222-222222222222.jpg', 'anyone can read an event flyer path';
  assert (select count(*) from storage.objects where bucket_id = 'event-flyers') = 0, 'anon cannot list flyers';

  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', '55555555-5555-4555-8555-555555555555.png');
    raise exception 'FAIL: anon uploaded a flyer';
  exception when insufficient_privilege then null; end;

  update storage.objects set name = '55555555-5555-4555-8555-555555555555.png' where bucket_id = 'event-flyers';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'anon cannot replace flyers';

  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'event-flyers';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'anon cannot delete flyers';
  perform set_config('storage.allow_delete_query', 'false', true);
end $$;
reset role;

-- The replace and delete policies on their own: members and anon normally
-- can't even list flyers, which already hides every row from UPDATE/DELETE.
-- Let everyone list them (test-only policy, dropped below and rolled back),
-- so only the replace/delete policies can stop the writes.
create policy "TEST ONLY: everyone lists flyers" on storage.objects
  for select to anon, authenticated using (bucket_id = 'event-flyers');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  assert (select count(*) from storage.objects where bucket_id = 'event-flyers') = 1, 'test-only listing policy works';
  update storage.objects set name = '44444444-4444-4444-8444-444444444444.png' where bucket_id = 'event-flyers';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'replace policy alone stops members';
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'event-flyers';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'delete policy alone stops members';
  perform set_config('storage.allow_delete_query', 'false', true);
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare v_rows int;
begin
  assert (select count(*) from storage.objects where bucket_id = 'event-flyers') = 1, 'test-only listing policy works (anon)';
  update storage.objects set name = '55555555-5555-4555-8555-555555555555.png' where bucket_id = 'event-flyers';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'replace policy alone stops anon';
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'event-flyers';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'delete policy alone stops anon';
  perform set_config('storage.allow_delete_query', 'false', true);
end $$;
reset role;

drop policy "TEST ONLY: everyone lists flyers" on storage.objects;

-- Officer: delete.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'event-flyers' and name = '22222222-2222-4222-8222-222222222222.jpg';
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'officers can delete flyers';
  perform set_config('storage.allow_delete_query', 'false', true);
end $$;
reset role;

-------------------------------------------------------------------------------
-- Event covers: events.cover_* checks and covers/ names in the same bucket.
-------------------------------------------------------------------------------

-- Officer: upload a cover, bad names rejected, cover columns on an event.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_id uuid := current_setting('test.flyer_event')::uuid;
begin
  insert into storage.objects (bucket_id, name) values ('event-flyers', 'covers/66666666-6666-4666-8666-666666666666.webp');
  insert into storage.objects (bucket_id, name) values ('event-flyers', 'covers/77777777-7777-4777-8777-777777777777.jpg');
  assert (select count(*) from storage.objects where bucket_id = 'event-flyers' and name like 'covers/%') = 2,
    'officers can upload covers';

  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', 'covers/../88888888-8888-4888-8888-888888888888.webp');
    raise exception 'FAIL: officer uploaded a cover with a bad name';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', 'covers/88888888-8888-4888-8888-888888888888.gif');
    raise exception 'FAIL: officer uploaded a non-image cover name';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', '88888888-8888-4888-8888-888888888888.webp');
    raise exception 'FAIL: officer uploaded a WebP flyer at the bucket root';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', 'other/88888888-8888-4888-8888-888888888888.png');
    raise exception 'FAIL: officer uploaded into another folder';
  exception when insufficient_privilege then null; end;
  begin
    update storage.objects set name = 'covers/x.webp'
     where bucket_id = 'event-flyers' and name = 'covers/77777777-7777-4777-8777-777777777777.jpg';
    raise exception 'FAIL: officer renamed a cover to a bad name';
  exception when insufficient_privilege then null; end;

  begin
    update public.events set cover_path = '66666666-6666-4666-8666-666666666666.webp', cover_width = 1600, cover_height = 800 where id = v_id;
    raise exception 'FAIL: cover_path accepted a name outside covers/';
  exception when check_violation then null; end;
  begin
    update public.events set cover_path = 'covers/66666666-6666-4666-8666-666666666666.webp', cover_width = 1000, cover_height = 500 where id = v_id;
    raise exception 'FAIL: cover smaller than 1200 x 600 accepted';
  exception when check_violation then null; end;
  begin
    update public.events set cover_width = 1600, cover_height = 800 where id = v_id;
    raise exception 'FAIL: cover size kept without a cover';
  exception when check_violation then null; end;
  begin
    update public.events set flyer_path = '88888888-8888-4888-8888-888888888888.webp' where id = v_id;
    raise exception 'FAIL: flyer_path accepted WebP';
  exception when check_violation then null; end;

  update public.events set cover_path = 'covers/66666666-6666-4666-8666-666666666666.webp', cover_width = 1600, cover_height = 800
   where id = v_id;
  assert (select cover_width from public.events where id = v_id) = 1600, 'officers can set an event cover';
end $$;
reset role;

-- Member and anon: can read the cover path, cannot upload, rename or delete covers.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  assert (select cover_path from public.events where id = current_setting('test.flyer_event')::uuid)
    = 'covers/66666666-6666-4666-8666-666666666666.webp', 'members can read an event cover path';
  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', 'covers/99999999-9999-4999-8999-999999999999.webp');
    raise exception 'FAIL: member uploaded a cover';
  exception when insufficient_privilege then null; end;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'event-flyers' and name like 'covers/%';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot delete covers';
  perform set_config('storage.allow_delete_query', 'false', true);
  update public.events set cover_path = null, cover_width = null, cover_height = null
   where id = current_setting('test.flyer_event')::uuid;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot remove an event cover';
end $$;
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
do $$ begin
  assert (select cover_path from public.events where id = current_setting('test.flyer_event')::uuid)
    = 'covers/66666666-6666-4666-8666-666666666666.webp', 'anyone can read an event cover path';
  begin
    insert into storage.objects (bucket_id, name) values ('event-flyers', 'covers/99999999-9999-4999-8999-999999999999.webp');
    raise exception 'FAIL: anon uploaded a cover';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Officer: delete a cover file.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'event-flyers' and name = 'covers/77777777-7777-4777-8777-777777777777.jpg';
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'officers can delete covers';
  perform set_config('storage.allow_delete_query', 'false', true);
end $$;
reset role;

-------------------------------------------------------------------------------
-- Roblox user ID (avatars): only the member and officers can read it.
-------------------------------------------------------------------------------
do $$ begin
  assert (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
    'roblox tests expect b to be an officer here';
  assert not (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
    'roblox tests expect c to be a member here';
end $$;

-- Member: saves their own ID, can't see anyone else's, can't set someone else's.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  update public.profiles set roblox_username = 'Nora_Builds', roblox_user_id = 1234567 where id = auth.uid();
  assert (select roblox_user_id from public.profiles where id = auth.uid()) = 1234567,
    'members can save and read their own Roblox user ID';

  assert (select count(*) from public.profiles where id <> auth.uid()) = 0,
    'members cannot read other profiles (or their Roblox user IDs)';
  assert (select count(*) from public.member_attendance where id <> auth.uid()) = 0,
    'members cannot read other Roblox user IDs through the members view';

  update public.profiles set roblox_user_id = 7654321 where id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot set someone else''s Roblox user ID';

  begin
    update public.profiles set roblox_username = null where id = auth.uid();
    raise exception 'FAIL: Roblox user ID kept without a username';
  exception when check_violation then null; end;
  begin
    update public.profiles set roblox_user_id = 0 where id = auth.uid();
    raise exception 'FAIL: Roblox user ID 0 accepted';
  exception when check_violation then null; end;
end $$;
reset role;

-- Officer: reads members' Roblox user IDs (table and members view).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select roblox_user_id from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 1234567,
    'officers can read members'' Roblox user IDs';
  assert (select roblox_user_id from public.member_attendance where id = '00000000-0000-0000-0000-00000000000c') = 1234567,
    'officers see Roblox user IDs in the members view';
end $$;
reset role;

-- Anon: no access to profiles at all.
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$ begin
  begin
    perform roblox_user_id from public.profiles;
    raise exception 'FAIL: anon read profiles';
  exception when insufficient_privilege then null; end;
  begin
    perform roblox_user_id from public.member_attendance;
    raise exception 'FAIL: anon read the members view';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-------------------------------------------------------------------------------
-- Live game links: officers write; checked-in members read only while live.
-------------------------------------------------------------------------------

-- Setup (as the test runner, bypassing RLS): a live, a future and an ended
-- event; member c is checked in to all three (member a to none).
do $$
declare v_live uuid; v_future uuid; v_ended uuid;
begin
  insert into public.events (title, starts_at, ends_at) values ('Game live', now() - interval '30 minutes', now() + interval '1 hour') returning id into v_live;
  insert into public.events (title, starts_at, ends_at) values ('Game later', now() + interval '1 day', now() + interval '1 day 2 hours') returning id into v_future;
  insert into public.events (title, starts_at, ends_at) values ('Game over', now() - interval '3 hours', now() - interval '1 hour') returning id into v_ended;
  insert into public.attendance (event_id, user_id) values
    (v_live, '00000000-0000-0000-0000-00000000000c'),
    (v_future, '00000000-0000-0000-0000-00000000000c'),
    (v_ended, '00000000-0000-0000-0000-00000000000c');
  perform set_config('test.g_live', v_live::text, true);
  perform set_config('test.g_future', v_future::text, true);
  perform set_config('test.g_ended', v_ended::text, true);
  assert (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
    'game link tests expect b to be an officer here';
  assert not (select is_officer from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
    'game link tests expect c to be a member here';
end $$;

-- Officer: post, replace, read; bad links rejected; changes are broadcast (empty).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_live uuid := current_setting('test.g_live')::uuid;
begin
  insert into public.event_game_links (event_id, url, label)
  values (v_live, 'https://www.roblox.com/games/123/Obby?privateServerLinkCode=abc', 'Server 1');
  update public.event_game_links set url = 'https://www.roblox.com/share?code=xyz&type=Server', label = null
   where event_id = v_live;
  insert into public.event_game_links (event_id, url)
  values (current_setting('test.g_future')::uuid, 'https://roblox.com/games/1'),
         (current_setting('test.g_ended')::uuid, 'https://roblox.com/games/2');
  assert (select url from public.event_game_links where event_id = v_live) = 'https://www.roblox.com/share?code=xyz&type=Server',
    'officers can post and replace a game link';
  assert (select updated_by from public.event_game_links where event_id = v_live) = '00000000-0000-0000-0000-00000000000b',
    'updated_by defaults to the officer';

  begin
    update public.event_game_links set url = 'https://evil.example/roblox.com/games/1' where event_id = v_live;
    raise exception 'FAIL: non-roblox.com link accepted';
  exception when check_violation then null; end;
  begin
    update public.event_game_links set url = 'https://roblox.com.evil.example/games/1' where event_id = v_live;
    raise exception 'FAIL: look-alike roblox.com host accepted';
  exception when check_violation then null; end;
  begin
    update public.event_game_links set url = 'http://www.roblox.com/games/1' where event_id = v_live;
    raise exception 'FAIL: http link accepted';
  exception when check_violation then null; end;
  begin
    update public.event_game_links set url = 'javascript:alert(1)//https://roblox.com/' where event_id = v_live;
    raise exception 'FAIL: javascript: link accepted';
  exception when check_violation then null; end;
  begin
    update public.event_game_links set label = repeat('x', 61) where event_id = v_live;
    raise exception 'FAIL: 61-character label accepted';
  exception when check_violation then null; end;

  perform set_config('realtime.topic', 'game:' || v_live, true);
  assert (select count(*) from realtime.messages where topic = realtime.topic()) >= 2,
    'officers receive game link changes';
  assert not exists (select 1 from realtime.messages where topic like 'game:%' and payload::text ilike '%roblox%'),
    'game link broadcasts never contain the link';
end $$;
reset role;

-- Checked-in member: reads the live event's link only; can't write; can listen.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int; v_live uuid := current_setting('test.g_live')::uuid;
begin
  assert (select url from public.event_game_links where event_id = v_live) = 'https://www.roblox.com/share?code=xyz&type=Server',
    'checked-in members can read the link while the event is live';
  assert not exists (select 1 from public.event_game_links where event_id = current_setting('test.g_future')::uuid),
    'members cannot read the link before the event starts';
  assert not exists (select 1 from public.event_game_links where event_id = current_setting('test.g_ended')::uuid),
    'members cannot read the link after the event ends';

  begin
    insert into public.event_game_links (event_id, url) values (current_setting('test.e1')::uuid, 'https://roblox.com/games/9');
    raise exception 'FAIL: member posted a game link';
  exception when insufficient_privilege then null; end;
  update public.event_game_links set url = 'https://roblox.com/games/9' where event_id = v_live;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot replace a game link';
  delete from public.event_game_links where event_id = v_live;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot clear a game link';

  perform set_config('realtime.topic', 'game:' || v_live, true);
  assert (select count(*) from realtime.messages where topic = realtime.topic()) >= 2,
    'checked-in members receive (empty) game link changes';
  perform set_config('realtime.topic', 'game:' || current_setting('test.e1'), true);
  assert (select count(*) from realtime.messages where topic = realtime.topic()) = 0,
    'members cannot listen to game links for events they are not checked in to';
  perform set_config('realtime.topic', 'game:not-a-uuid', true);
  assert (select count(*) from realtime.messages where topic = realtime.topic()) = 0,
    'malformed game topics are refused, not errors';
end $$;
reset role;

-- Member who is NOT checked in: reads nothing, even for the live event.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert not (select private.is_officer()), 'game link tests expect a to be a member here';
  assert not exists (select 1 from public.event_game_links),
    'members who are not checked in cannot read game links';
  perform set_config('realtime.topic', 'game:' || current_setting('test.g_live'), true);
  assert (select count(*) from realtime.messages where topic = realtime.topic()) = 0,
    'members who are not checked in cannot listen for game link changes';
end $$;
reset role;

-- Anon: nothing.
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$ begin
  begin
    perform 1 from public.event_game_links;
    raise exception 'FAIL: anon read game links';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.event_game_links (event_id, url) values (current_setting('test.g_live')::uuid, 'https://roblox.com/games/9');
    raise exception 'FAIL: anon posted a game link';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Officer: clear; the member then sees nothing.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  delete from public.event_game_links where event_id = current_setting('test.g_live')::uuid;
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'officers can clear a game link';
end $$;
reset role;

-------------------------------------------------------------------------------
-- Announcements: anyone reads the active one; only officers write.
-------------------------------------------------------------------------------

-- Officer (b): publish, bad input rejected, only one at a time.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select private.is_officer()), 'announcement tests expect b to be an officer here';
  insert into public.announcements (message, link, style) values ('Game night moved to BBB 1670', '/events', 'urgent');

  begin
    insert into public.announcements (message) values ('A second one');
    raise exception 'FAIL: two announcements at once';
  exception when unique_violation then null; end;

  begin
    update public.announcements set message = repeat('x', 141);
    raise exception 'FAIL: 141-character message accepted';
  exception when check_violation then null; end;
  begin
    update public.announcements set message = '';
    raise exception 'FAIL: empty message accepted';
  exception when check_violation then null; end;
  begin
    update public.announcements set style = 'party';
    raise exception 'FAIL: unknown style accepted';
  exception when check_violation then null; end;

  -- Links: our own paths, https roblox.com / umich.edu (and subdomains) only.
  update public.announcements set link = '/';
  update public.announcements set link = '/events/abc?x=1';
  update public.announcements set link = 'https://www.roblox.com/games/1';
  update public.announcements set link = 'https://umich.edu';
  update public.announcements set link = 'https://campusinfo.umich.edu/maps';
  declare bad text;
  begin
    foreach bad in array array[
      '//evil.example/x', '/\evil.example', 'https://evil.example/', 'http://www.roblox.com/',
      'https://roblox.com.evil.example/', 'https://evilumich.edu/', 'javascript:alert(1)',
      'https://umich.edu@evil.example/', '/has space'
    ] loop
      begin
        update public.announcements set link = bad;
        raise exception 'FAIL: announcement link accepted: %', bad;
      exception when check_violation then null; end;
    end loop;
  end;
end $$;
reset role;
-- (Checked as the owner: created_by isn't readable through the API.)
do $$ begin
  assert (select created_by from public.announcements) = '00000000-0000-0000-0000-00000000000b',
    'created_by defaults to the officer';
end $$;

-- Member (c) and anon: read the active announcement, can't write.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  assert (select count(*) from public.announcements) = 1, 'members can read the active announcement';
  begin
    insert into public.announcements (message) values ('Hacked');
    raise exception 'FAIL: member published an announcement';
  exception when insufficient_privilege then null; end;
  update public.announcements set message = 'Hacked';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot edit the announcement';
  delete from public.announcements;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot clear the announcement';
end $$;
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
declare v_rows int;
begin
  assert (select message from public.announcements) = 'Game night moved to BBB 1670', 'anyone can read the active announcement';
  begin
    insert into public.announcements (message) values ('Hacked');
    raise exception 'FAIL: anon published an announcement';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.announcements;
    raise exception 'FAIL: anon cleared the announcement';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Past its hide-after time: gone for everyone but officers.
update public.announcements set hide_after = now() - interval '1 minute';
set local role anon;
do $$ begin
  assert (select count(*) from public.announcements) = 0, 'anon cannot see an expired announcement';
end $$;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.announcements) = 0, 'members cannot see an expired announcement';
end $$;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  assert (select count(*) from public.announcements) = 1, 'officers still see an expired announcement';
  delete from public.announcements;
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'officers can clear the announcement';
end $$;
reset role;

-------------------------------------------------------------------------------
-- RSVPs: members add/remove/read only their own (until the event ends);
-- officers read all; anon nothing.
-------------------------------------------------------------------------------

-- Member (c): RSVP for upcoming and live events, not ended ones or for others.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  assert not (select private.is_officer()), 'RSVP tests expect c to be a member';
  insert into public.event_rsvps (event_id) values (current_setting('test.g_future')::uuid);
  insert into public.event_rsvps (event_id) values (current_setting('test.g_live')::uuid);
  assert (select count(*) from public.event_rsvps) = 2, 'member reads their own RSVPs';
  assert (select user_id from public.event_rsvps where event_id = current_setting('test.g_future')::uuid)
    = '00000000-0000-0000-0000-00000000000c', 'user_id defaults to the member';

  begin
    insert into public.event_rsvps (event_id) values (current_setting('test.g_ended')::uuid);
    raise exception 'FAIL: RSVP to an ended event';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.event_rsvps (event_id, user_id)
      values (current_setting('test.g_future')::uuid, '00000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL: RSVP on behalf of someone else';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.event_rsvps (event_id) values (current_setting('test.g_future')::uuid);
    raise exception 'FAIL: duplicate RSVP';
  exception when unique_violation then null; end;
  begin
    update public.event_rsvps set created_at = now() - interval '1 day';
    raise exception 'FAIL: member updated an RSVP';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Seed RSVPs the member can't create themselves: one by b, and one by c on the
-- ended event (from before it ended).
insert into public.event_rsvps (event_id, user_id) values
  (current_setting('test.g_future')::uuid, '00000000-0000-0000-0000-00000000000b'),
  (current_setting('test.g_ended')::uuid, '00000000-0000-0000-0000-00000000000c');

set local role authenticated;
do $$
declare v_rows int;
begin
  assert (select count(*) from public.event_rsvps) = 3, 'member sees only their own RSVPs (not b''s)';
  delete from public.event_rsvps where user_id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'member cannot remove someone else''s RSVP';
  delete from public.event_rsvps where event_id = current_setting('test.g_ended')::uuid;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'RSVPs are fixed once the event ends';
  delete from public.event_rsvps where event_id = current_setting('test.g_future')::uuid;
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'member removes their own RSVP';
end $$;
reset role;

-- Another member (a, not an officer here): sees none of c's or b's.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert not (select private.is_officer()), 'RSVP tests expect a to be a member here';
  assert (select count(*) from public.event_rsvps) = 0, 'members cannot see other members'' RSVPs';
end $$;
reset role;

-- Officer (b): reads every RSVP.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select private.is_officer()), 'RSVP tests expect b to be an officer';
  assert (select count(*) from public.event_rsvps) = 3, 'officers read all RSVPs';
end $$;
reset role;

-- Anon: nothing.
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$ begin
  begin
    perform count(*) from public.event_rsvps;
    raise exception 'FAIL: anon read RSVPs';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.event_rsvps (event_id, user_id)
      values (current_setting('test.g_future')::uuid, '00000000-0000-0000-0000-00000000000c');
    raise exception 'FAIL: anon RSVPed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-------------------------------------------------------------------------------
-- Name (locked, from Google) and nickname (member's own; officers can clear)
-------------------------------------------------------------------------------
-- Known roles for this section: a is the only officer (and owner); b and c are members.
update public.profiles set is_officer = true, is_owner = true where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_owner = false where id::text like '00000000-0000-0000-0000-00000000000%'
   and id <> '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_officer = (id = '00000000-0000-0000-0000-00000000000a')
 where id::text like '00000000-0000-0000-0000-00000000000%';
update public.profiles set nickname = null where id::text like '00000000-0000-0000-0000-00000000000%';

-- Member c: sets their own nickname; can't edit their name or anyone else's nickname.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","email":"newbie@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  update public.profiles set nickname = 'Nor' where id = auth.uid();
  assert (select nickname from public.profiles where id = auth.uid()) = 'Nor',
    'members can set and read their own nickname';
  update public.profiles set nickname = 'Zoë O''Neil-Smith (Z)!' where id = auth.uid();
  assert (select nickname from public.profiles where id = auth.uid()) = 'Zoë O''Neil-Smith (Z)!',
    'nicknames allow accented letters and basic punctuation';
  update public.profiles set nickname = null where id = auth.uid();
  assert (select nickname from public.profiles where id = auth.uid()) is null,
    'members can clear their own nickname';

  -- Ignored rather than refused, so the older site version keeps saving.
  update public.profiles set full_name = 'Someone Else', roblox_username = 'Nora_Builds2' where id = auth.uid();
  assert (select full_name from public.profiles where id = auth.uid()) = 'Nora Newbie',
    'members cannot change their own name';
  assert (select roblox_username from public.profiles where id = auth.uid()) = 'Nora_Builds2',
    'the rest of a save that includes full_name still goes through';

  update public.profiles set nickname = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'members cannot set someone else''s nickname';

  begin
    update public.profiles set nickname = '' where id = auth.uid();
    raise exception 'FAIL: empty nickname accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set nickname = repeat('a', 31) where id = auth.uid();
    raise exception 'FAIL: 31-character nickname accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set nickname = ' Nora' where id = auth.uid();
    raise exception 'FAIL: untrimmed nickname accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set nickname = '<script>' where id = auth.uid();
    raise exception 'FAIL: nickname with < > accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set nickname = '...' where id = auth.uid();
    raise exception 'FAIL: punctuation-only nickname accepted';
  exception when check_violation then null; end;

  begin
    perform public.clear_nickname('00000000-0000-0000-0000-00000000000b');
    raise exception 'FAIL: member cleared a nickname';
  exception when insufficient_privilege then null; end;

  update public.profiles set nickname = 'Nora B' where id = auth.uid();
end $$;
reset role;

-- Name syncs from Google on sign-in (non-empty names only).
update auth.users set raw_user_meta_data = '{"full_name":"Nora Newbie-Google"}'
 where id = '00000000-0000-0000-0000-00000000000c';
update auth.users set raw_user_meta_data = '{"full_name":""}'
 where id = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'Nora Newbie-Google',
    'name is refreshed from Google on sign-in';
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'Max Member',
    'an empty name from Google doesn''t wipe the saved name';
end $$;

-- Officer a: reads nicknames (table and members view); clears one; can't set one.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_rows int;
begin
  assert (select nickname from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'Nora B',
    'officers can read members'' nicknames';
  assert (select nickname from public.member_attendance where id = '00000000-0000-0000-0000-00000000000c') = 'Nora B',
    'officers see nicknames in the members view';

  update public.profiles set nickname = 'Officer Pick' where id = '00000000-0000-0000-0000-00000000000c';
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'officers cannot set a member''s nickname';

  perform public.clear_nickname('00000000-0000-0000-0000-00000000000c');
  assert (select nickname from public.profiles where id = '00000000-0000-0000-0000-00000000000c') is null,
    'officers can clear a member''s nickname';

  begin
    perform public.clear_nickname('00000000-0000-0000-0000-0000000000ff');
    raise exception 'FAIL: cleared a nickname for a missing member';
  exception when no_data_found then null; end;
end $$;
reset role;

-- Member b reading: nobody else's nickname. Anon: nothing.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.profiles where id <> auth.uid() and nickname is not null) = 0,
    'members cannot read other members'' nicknames';
end $$;
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
do $$ begin
  begin
    perform nickname from public.profiles;
    raise exception 'FAIL: anon read nicknames';
  exception when insufficient_privilege then null; end;
  begin
    perform public.clear_nickname('00000000-0000-0000-0000-00000000000c');
    raise exception 'FAIL: anon cleared a nickname';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-------------------------------------------------------------------------------
-- created_by is not public (events: hidden from anon; announcements: hidden from all)
-------------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$ begin
  assert (select count(*) from public.events where id::text = current_setting('test.e1')) = 1,
    'anon still reads public event columns';
  perform id, title, description, location, starts_at, ends_at, category, capacity,
          flyer_path, flyer_width, flyer_height, cover_path, cover_width, cover_height, updated_at
     from public.events;
  begin
    perform created_by from public.events;
    raise exception 'FAIL: anon read events.created_by';
  exception when insufficient_privilege then null; end;
  begin
    perform created_by from public.announcements;
    raise exception 'FAIL: anon read announcements.created_by';
  exception when insufficient_privilege then null; end;
  perform id, message, link, style, hide_after from public.announcements;
end $$;
reset role;

-- Officers keep the computed check-in column (a whole-row reference to events).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform e.checkin_is_open from public.events e;
  begin
    perform created_by from public.announcements;
    raise exception 'FAIL: signed-in user read announcements.created_by';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'ALL SECURITY TESTS PASSED' as result;

rollback;
