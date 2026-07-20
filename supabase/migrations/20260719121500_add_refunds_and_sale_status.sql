-- Sale lifecycle status. Existing rows backfill to 'completed'.
alter table public.sales
  add column status text not null default 'completed'
    check (status in ('completed', 'voided', 'partially_refunded', 'refunded'));

-- Admins need to update a sale's status when voiding/refunding it; sales
-- previously only had insert (checkout) and admin-only select policies.
create policy "Admins can update sales" on public.sales
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- One row per void/partial-refund/full-refund action against a sale.
-- id is client-generated text (`REFUND-<timestamp>`), matching the existing
-- `SALE-<timestamp>` convention on public.sales.id.
create table public.refunds (
  id text primary key,
  "saleId" text not null references public.sales(id),
  items jsonb not null,
  amount numeric not null,
  reason text,
  "refundedBy" uuid references public.profiles(id),
  "createdAt" timestamptz not null default now()
);

alter table public.refunds enable row level security;

create policy "Admins can insert refunds" on public.refunds
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Admins can read refunds" on public.refunds
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- Reverses decrement_branch_stock for refunds/voids. Same security-definer
-- trust model as decrement_branch_stock (granted broadly to authenticated;
-- the app only calls it from the admin-only Order History refund/void flow).
create or replace function public.increment_branch_stock(p_branch_id int, p_items jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update branch_stock bs
  set stock = bs.stock + i.quantity
  from jsonb_to_recordset(p_items) as i("productId" int, quantity int)
  where bs."productId" = i."productId"
    and bs."branchId" = p_branch_id;
$$;

revoke execute on function public.increment_branch_stock(int, jsonb) from public, anon;
grant execute on function public.increment_branch_stock(int, jsonb) to authenticated;
