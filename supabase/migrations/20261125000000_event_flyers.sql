-- Event flyers: an optional image per event, stored in the public Storage
-- bucket "event-flyers". Anyone can view a flyer (public bucket URLs bypass
-- RLS); only officers can upload, replace, list or delete objects.
--
-- Objects are named "<random uuid>.png" or "<random uuid>.jpg" at the bucket
-- root. A replacement is uploaded under a NEW name and the old object deleted,
-- so CDN and browser caches can never show a stale flyer.

-------------------------------------------------------------------------------
-- events.flyer_*  (public, like the rest of an event's details)
-------------------------------------------------------------------------------

alter table public.events
  add column flyer_path text
    constraint events_flyer_path_check
    check (flyer_path is null or flyer_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$'),
  -- Intrinsic size, so the page can reserve the right space (no layout shift).
  add column flyer_width int,
  add column flyer_height int,
  add constraint events_flyer_dims_check check (
    (flyer_path is null and flyer_width is null and flyer_height is null)
    or (flyer_path is not null and flyer_width between 1 and 20000 and flyer_height between 1 and 20000)
  );

-- RLS on events is unchanged: anyone may read, officers may write.

-------------------------------------------------------------------------------
-- Bucket: public read, 5 MB max, PNG/JPEG only (enforced by the Storage API).
-------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-flyers', 'event-flyers', true, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-------------------------------------------------------------------------------
-- storage.objects policies for this bucket. No anon/member policies exist, so
-- for them every write is denied and API listing returns nothing.
-------------------------------------------------------------------------------

create policy "Officers upload event flyers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-flyers'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$'
    and (select private.is_officer())
  );

create policy "Officers replace event flyers"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-flyers' and (select private.is_officer()))
  with check (
    bucket_id = 'event-flyers'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$'
    and (select private.is_officer())
  );

create policy "Officers delete event flyers"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-flyers' and (select private.is_officer()));

-- The Storage API needs SELECT to delete (and to upsert); officers only.
create policy "Officers list event flyers"
  on storage.objects for select to authenticated
  using (bucket_id = 'event-flyers' and (select private.is_officer()));
