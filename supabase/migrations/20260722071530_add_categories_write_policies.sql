-- categories has only ever had a select policy (predates tracked migrations) —
-- there's no create/update/delete path anywhere in the app yet. Add write
-- policies gated the same way every other admin-writable table is (role in
-- ('admin', 'manager')), using the existing is_admin_or_manager() helper.
create policy "Admins can insert categories" on public.categories
  for insert to authenticated
  with check (public.is_admin_or_manager());

create policy "Admins can update categories" on public.categories
  for update to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy "Admins can delete categories" on public.categories
  for delete to authenticated
  using (public.is_admin_or_manager());
