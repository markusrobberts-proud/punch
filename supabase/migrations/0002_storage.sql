-- Knowledge bank file uploads: Supabase Storage bucket + RLS

insert into storage.buckets (id, name, public)
values ('knowledge-files', 'knowledge-files', false)
on conflict (id) do nothing;

-- Authenticated users can upload to brand folders they have access to.
-- Object paths are organised as: <brand_id>/<knowledge_item_id>/<filename>
drop policy if exists "knowledge files: brand members can upload" on storage.objects;
create policy "knowledge files: brand members can upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'knowledge-files'
  and public.has_brand_access((storage.foldername(name))[1]::uuid)
);

drop policy if exists "knowledge files: brand members can read" on storage.objects;
create policy "knowledge files: brand members can read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'knowledge-files'
  and public.has_brand_access((storage.foldername(name))[1]::uuid)
);

drop policy if exists "knowledge files: brand members can delete" on storage.objects;
create policy "knowledge files: brand members can delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'knowledge-files'
  and public.has_brand_access((storage.foldername(name))[1]::uuid)
);
