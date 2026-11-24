-- "I'm going" RSVPs. Private: members add, remove and read only their own;
-- officers read all. Never shown publicly. RSVP is open until the event ends
-- and never affects check-in.

create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_rsvps_user_id_idx on public.event_rsvps (user_id);

alter table public.event_rsvps enable row level security;

revoke all on public.event_rsvps from anon, authenticated;
grant select, insert, delete on public.event_rsvps to authenticated;

create policy "Members read their own RSVPs; officers read all"
  on public.event_rsvps for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_officer()));

create policy "Members RSVP for themselves until the event ends"
  on public.event_rsvps for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_umich())
    and exists (select 1 from public.events e where e.id = event_id and e.ends_at > now())
  );

create policy "Members remove their own RSVP until the event ends"
  on public.event_rsvps for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.ends_at > now())
  );
