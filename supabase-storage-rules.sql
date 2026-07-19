-- Run these SQL statements in your Supabase SQL Editor to configure rules for GCash receipt screenshot uploads:

-- 1. Create a public bucket named "receipts" if it doesn't already exist
insert into storage.buckets (id, name, public) 
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- 2. Allow public access to read receipt files
create policy "Allow Public Read Access on Receipts"
on storage.objects for select
using ( bucket_id = 'receipts' );

-- 3. Allow authenticated users to upload receipt files
create policy "Allow Authenticated Uploads on Receipts"
on storage.objects for insert
with check (
  bucket_id = 'receipts' 
  -- Optional security rule: only logged-in users can upload
  -- and auth.role() = 'authenticated'
);
