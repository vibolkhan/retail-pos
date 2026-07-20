create table public.customers (
  id serial primary key,
  name text not null,
  phone text,
  email text,
  "createdAt" timestamptz not null default now()
);

alter table public.customers enable row level security;

-- Open to any authenticated user, matching products/categories/branches —
-- salespeople need to search/quick-add a customer at checkout, not just admins.
create policy "Authenticated users can read customers" on public.customers
  for select to authenticated
  using (true);

create policy "Authenticated users can insert customers" on public.customers
  for insert to authenticated
  with check (true);

alter table public.sales add column "customerId" integer references public.customers(id);
