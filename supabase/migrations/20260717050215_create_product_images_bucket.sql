-- Public bucket for product photos, referenced by src/composables/useSupabase.ts (PRODUCT_IMAGE_BUCKET)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Anyone can read (bucket is public, matches getPublicUrl usage in code)
create policy "Public read access for product images"
on storage.objects for select
to public
using (bucket_id = 'product-images');

-- Only admins can upload new product images (matches InventoryPage.vue being admin-only)
create policy "Admins can upload product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);
