-- Header row + jsonb items array, matching the sales/refunds convention —
-- no separate purchase_items child table. Read/insert/update all gated to
-- admin/manager: unlike sales (any authenticated can insert via checkout),
-- purchases are always an admin/manager-triggered back-office action, so
-- there's no "salesperson inserts, admin reads" split to support here.
create table public.purchases (
  id text primary key,
  date timestamptz not null default now(),
  "branchId" int not null references public.branches(id),
  "supplierId" int references public.suppliers(id),
  items jsonb not null,
  subtotal numeric not null,
  status text not null default 'completed' check (status in ('completed', 'voided')),
  "createdBy" uuid references public.profiles(id),
  "createdAt" timestamptz not null default now(),
  "voidedAt" timestamptz,
  "voidedBy" uuid references public.profiles(id)
);

alter table public.purchases enable row level security;

create policy "Admins can read purchases" on public.purchases
  for select to authenticated
  using (public.is_admin_or_manager());

create policy "Admins can insert purchases" on public.purchases
  for insert to authenticated
  with check (public.is_admin_or_manager());

create policy "Admins can update purchases" on public.purchases
  for update to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());
