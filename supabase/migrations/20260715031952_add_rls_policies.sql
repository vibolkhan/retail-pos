-- profiles: each user can read their own profile (needed for login role lookup)
create policy "Users can read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- categories: readable by any logged-in user
create policy "Authenticated users can read categories" on public.categories
  for select to authenticated
  using (true);

-- products: readable by any logged-in user
create policy "Authenticated users can read products" on public.products
  for select to authenticated
  using (true);

-- products: only admins can create/update (Inventory page is admin-only)
create policy "Admins can insert products" on public.products
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Admins can update products" on public.products
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- sales: any logged-in user can record a sale (checkout)
create policy "Authenticated users can insert sales" on public.sales
  for insert to authenticated
  with check (true);

-- sales: only admins can read (Order History / dashboard are admin-only)
create policy "Admins can read sales" on public.sales
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- carts / cart_items: intentionally no policies — the app does not use these
-- tables, so they stay fully locked down.
