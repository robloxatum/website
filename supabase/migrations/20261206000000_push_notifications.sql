-- Opt-in push notifications (Web Push): event reminders and "game link is live".
--
-- One row per device (browser push subscription), owned by the member who
-- turned notifications on there, with that device's two settings.
--
-- Members: read, change the settings of, and delete their own rows; add or
-- take over a device only through save_push_subscription() (a device that
-- changes hands moves to whoever turned notifications on last).
-- Sending: the server, with the secret key (bypasses RLS), from lib/push.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The push service URL. https only (the app also only accepts the known push
  -- services); plain http on this machine only, for the local end-to-end tests.
  endpoint text not null unique
    constraint push_subscriptions_endpoint_check
    check (char_length(endpoint) <= 1000
           and (endpoint ~ '^https://[^\s/]+/' or endpoint ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/')),
  -- The device's public key (P-256, 65 bytes) and auth secret (16 bytes), base64url.
  p256dh text not null constraint push_subscriptions_p256dh_check check (p256dh ~ '^[A-Za-z0-9_-]{86,88}$'),
  auth text not null constraint push_subscriptions_auth_check check (auth ~ '^[A-Za-z0-9_-]{22,24}$'),
  event_reminders boolean not null default true,
  game_links boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant update (event_reminders, game_links, updated_at) on public.push_subscriptions to authenticated;

create policy "Members read their own devices"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members change their own devices' settings"
  on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Members remove their own devices"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Turn notifications on for this device (or update its keys and settings).
-- `p_replaces`: the browser rotated the subscription; the old one is removed
-- (only if it was the caller's) and, unless given, its settings carry over.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_event_reminders boolean default null,
  p_game_links boolean default null,
  p_replaces text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_old public.push_subscriptions;
begin
  if v_user is null or not private.is_umich() then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if p_replaces is not null and p_replaces <> p_endpoint then
    delete from public.push_subscriptions where endpoint = p_replaces and user_id = v_user
      returning * into v_old;
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, event_reminders, game_links)
  values (v_user, p_endpoint, p_p256dh, p_auth,
          coalesce(p_event_reminders, v_old.event_reminders, true),
          coalesce(p_game_links, v_old.game_links, true))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        event_reminders = coalesce(p_event_reminders, push_subscriptions.event_reminders),
        game_links = coalesce(p_game_links, push_subscriptions.game_links),
        updated_at = now();
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, boolean, boolean, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, boolean, boolean, text) to authenticated;

-- Which events have had their reminder sent (so a retried cron sends nothing twice).
-- Server only: no grants, no policies.
create table public.event_reminders_sent (
  event_id uuid primary key references public.events (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.event_reminders_sent enable row level security;
revoke all on public.event_reminders_sent from anon, authenticated;
