-- Event covers: an optional 2:1 image per event shown on cards and as the event
-- page banner. Events without one get a default cover from public/art/covers.
--
-- Stored in the existing public "event-flyers" bucket as
-- "covers/<random uuid>.png|jpg|webp", under the same officer-only policies as
-- flyers. Like flyers, a replacement gets a NEW name and the old object is deleted.

-------------------------------------------------------------------------------
-- events.cover_*  (public, like the rest of an event's details)
-------------------------------------------------------------------------------

alter table public.events
  add column cover_path text
    constraint events_cover_path_check
    check (cover_path is null or cover_path ~ '^covers/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'),
  -- Intrinsic size (no layout shift). At least 1200 x 600 so covers stay sharp.
  add column cover_width int,
  add column cover_height int,
  add constraint events_cover_dims_check check (
    (cover_path is null and cover_width is null and cover_height is null)
    or (cover_path is not null and cover_width between 1200 and 20000 and cover_height between 600 and 20000)
  );

-------------------------------------------------------------------------------
-- Bucket: also accept WebP (covers). Flyer names are still PNG/JPG only: the
-- flyer_path check and the policies below keep WebP out of the bucket root.
-------------------------------------------------------------------------------

update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'event-flyers';

-------------------------------------------------------------------------------
-- Upload/replace: flyers at the root, covers under covers/. Delete and list are
-- already officer-only for the whole bucket (event_flyers migration).
-------------------------------------------------------------------------------

drop policy "Officers upload event flyers" on storage.objects;
drop policy "Officers replace event flyers" on storage.objects;

create policy "Officers upload event flyers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-flyers'
    and name ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)|covers/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp))$'
    and (select private.is_officer())
  );

create policy "Officers replace event flyers"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-flyers' and (select private.is_officer()))
  with check (
    bucket_id = 'event-flyers'
    and name ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)|covers/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp))$'
    and (select private.is_officer())
  );
