-- New lookup table for wholesale batch units (e.g. "Case of 12" / "case"),
-- replacing the hardcoded 5-item preset array that used to live client-side
-- in InventoryPage.vue. Same shape/RLS breadth as categories/branches: readable
-- by any authenticated user, writable by admin/manager only.
create table public.batch_units (
  id serial primary key,
  name text not null unique,
  unit text not null,
  "createdAt" timestamptz not null default now()
);

alter table public.batch_units enable row level security;

create policy "Authenticated users can read batch units" on public.batch_units
  for select to authenticated
  using (true);

create policy "Admins can insert batch units" on public.batch_units
  for insert to authenticated
  with check (public.is_admin_or_manager());

create policy "Admins can update batch units" on public.batch_units
  for update to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy "Admins can delete batch units" on public.batch_units
  for delete to authenticated
  using (public.is_admin_or_manager());
