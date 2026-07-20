-- Branches: retail sells per unit, wholesale sells per case.
create table public.branches (
  id serial primary key,
  name text not null,
  type text not null check (type in ('retail', 'wholesale'))
);

insert into public.branches (name, type) values
  ('Retail Shop', 'retail'),
  ('Wholesale', 'wholesale');

-- Case pricing on products (nullable: not every product is sold wholesale).
alter table public.products
  add column "caseSize" int,
  add column "casePrice" numeric;

-- products.stock is being replaced by branch_stock; relax it so the new
-- frontend can stop sending it before the column is dropped.
alter table public.products
  alter column stock set default 0,
  alter column stock drop not null;

-- Per-branch stock, stored in the branch's selling unit
-- (retail = units, wholesale = cases).
create table public.branch_stock (
  "productId" int not null references public.products(id) on delete cascade,
  "branchId" int not null references public.branches(id),
  stock int not null default 0 check (stock >= 0),
  primary key ("productId", "branchId")
);

-- Migrate existing stock into the retail branch; wholesale starts at 0.
insert into public.branch_stock ("productId", "branchId", stock)
select p.id, b.id, coalesce(p.stock, 0)
from public.products p, public.branches b
where b.type = 'retail';

insert into public.branch_stock ("productId", "branchId", stock)
select p.id, b.id, 0
from public.products p, public.branches b
where b.type = 'wholesale';

-- Sales are branch-scoped; backfill existing sales to the retail branch.
alter table public.sales
  add column "branchId" int references public.branches(id);

update public.sales
set "branchId" = (select id from public.branches where type = 'retail');

-- RLS, consistent with existing tables.
alter table public.branches enable row level security;
alter table public.branch_stock enable row level security;

create policy "Authenticated users can read branches" on public.branches
  for select to authenticated
  using (true);

create policy "Authenticated users can read branch stock" on public.branch_stock
  for select to authenticated
  using (true);

create policy "Admins can insert branch stock" on public.branch_stock
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Admins can update branch stock" on public.branch_stock
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));
