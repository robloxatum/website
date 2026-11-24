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

update public.profiles set is_officer = true where id = '00000000-0000-0000-0000-00000000000a';

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
  assert (select count(*) from public.events) >= 2, 'member can read events';
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

  update public.profiles set roblox_username = 'Max_Builds', full_name = 'Max M.' where id = auth.uid();
  assert (select roblox_username from public.profiles where id = auth.uid()) = 'Max_Builds',
    'member can edit their own Roblox username';

  update public.profiles set full_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000a';
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
-- Officer management
-------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"officer@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  perform public.set_officer('00000000-0000-0000-0000-00000000000b', true);
  assert (select count(*) from public.profiles) = 3, 'officer reads all profiles';
  assert (select count(*) from public.attendance) = 2, 'officer reads all attendance';
end $$;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"member@umich.edu","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.event_codes) = 2, 'a promoted officer can read codes';
  perform public.set_officer('00000000-0000-0000-0000-00000000000a', false);
  begin
    perform public.set_officer('00000000-0000-0000-0000-00000000000b', false);
    raise exception 'FAIL: removed the last officer';
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

select 'ALL SECURITY TESTS PASSED' as result;

rollback;
