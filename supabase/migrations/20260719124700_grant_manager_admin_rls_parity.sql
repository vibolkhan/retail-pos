-- 'manager' is meant to have the same access as 'admin' everywhere. The
-- router/UI change alone isn't enough — every RLS policy gated on
-- role = 'admin' also has to admit 'manager', or a manager hits a silent
-- permission error the moment they try to write through one of these.
alter policy "Admins can insert products" on public.products
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can update products" on public.products
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can delete products" on public.products
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can insert branch stock" on public.branch_stock
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can update branch stock" on public.branch_stock
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can read sales" on public.sales
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can update sales" on public.sales
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can insert refunds" on public.refunds
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can read refunds" on public.refunds
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can read all profiles" on public.profiles
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can insert settings" on public.settings
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can update settings" on public.settings
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'manager')));

alter policy "Admins can upload product images" on storage.objects
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'manager'))
  );
