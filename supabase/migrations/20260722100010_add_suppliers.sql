-- New lookup table for Purchase suppliers. Same shape as customers, but
-- NOT customer-like open-insert: suppliers are back-office master data,
-- entered only by admin/manager, same RLS breadth as categories/batch_units.
create table public.suppliers (
  id serial primary key,
  name text not null,
  phone text,
  email text,
  "createdAt" timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create policy "Authenticated users can read suppliers" on public.suppliers
  for select to authenticated
  using (true);

create policy "Admins can insert suppliers" on public.suppliers
  for insert to authenticated
  with check (public.is_admin_or_manager());

create policy "Admins can update suppliers" on public.suppliers
  for update to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy "Admins can delete suppliers" on public.suppliers
  for delete to authenticated
  using (public.is_admin_or_manager());
