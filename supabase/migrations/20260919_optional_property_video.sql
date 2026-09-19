-- Allow each property to include one optional public walkthrough video.
-- Existing listings remain unchanged because video_url is nullable.

alter table public.properties
  add column if not exists video_url text;

comment on column public.properties.video_url is
  'Optional public URL for the property walkthrough video.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'property-videos',
  'property-videos',
  true,
  52428800,
  array['video/mp4', 'video/webm']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Landlords upload their property videos'
  ) then
    create policy "Landlords upload their property videos"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'property-videos'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Landlords update their property videos'
  ) then
    create policy "Landlords update their property videos"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'property-videos'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      )
      with check (
        bucket_id = 'property-videos'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Landlords delete their property videos'
  ) then
    create policy "Landlords delete their property videos"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'property-videos'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;
end
$$;
