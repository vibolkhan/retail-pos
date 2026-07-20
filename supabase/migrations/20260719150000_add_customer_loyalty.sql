-- Customer loyalty: a running points balance on each customer, backed by a
-- ledger table so every earn/redeem/manual-adjust is auditable, plus a
-- 'loyalty' settings row (same key/value table currency uses) for the
-- program's earn/redeem rates.

alter table public.customers add column "loyaltyPoints" integer not null default 0;

-- customers previously had no update policy at all (only read/insert) —
-- checkout needs to write loyaltyPoints for any authenticated role, same
-- breadth as the existing read/insert policies.
create policy "Authenticated users can update customers" on public.customers
  for update to authenticated
  using (true)
  with check (true);

insert into public.settings (key, value) values
  ('loyalty', jsonb_build_object(
    'enabled', true,
    'pointsPerCurrency', 1,
    'redemptionPointsPerCurrency', 100,
    'minRedeemPoints', 100
  ));

-- One row per earn/redeem/adjust action against a customer's balance.
-- id is client-generated text (`LOYALTY-<timestamp>`), matching the
-- SALE-/REFUND- id convention already used on sales/refunds.
create table public.loyalty_transactions (
  id text primary key,
  "customerId" integer not null references public.customers(id),
  "saleId" text references public.sales(id),
  type text not null check (type in ('earn', 'redeem', 'adjust')),
  points integer not null,
  "balanceAfter" integer not null,
  note text,
  "createdBy" uuid references public.profiles(id),
  "createdAt" timestamptz not null default now()
);

alter table public.loyalty_transactions enable row level security;

-- Insert is as broad as sales insert (checkout runs as any authenticated
-- role) — earning/redeeming points happens at checkout, not just from the
-- admin-only Customers page.
create policy "Authenticated users can insert loyalty transactions" on public.loyalty_transactions
  for insert to authenticated
  with check (true);

create policy "Admins can read loyalty transactions" on public.loyalty_transactions
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'manager')
  ));

alter table public.sales add column "pointsEarned" integer;
alter table public.sales add column "pointsRedeemed" integer;

-- Atomically adjusts a customer's points balance and returns the new
-- balance (SECURITY DEFINER so salespersons can earn/redeem points even
-- though customers writes are otherwise a plain "authenticated" policy
-- evaluated per-row, same trust model as decrement/increment_branch_stock).
-- Clamps at 0: redeeming under a race with a stale balance must never send
-- a customer negative or fail an otherwise-completed sale.
create or replace function public.adjust_loyalty_points(p_customer_id int, p_delta int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance int;
begin
  update customers
  set "loyaltyPoints" = greatest("loyaltyPoints" + p_delta, 0)
  where id = p_customer_id
  returning "loyaltyPoints" into new_balance;

  return new_balance;
end;
$$;

revoke execute on function public.adjust_loyalty_points(int, int) from public, anon;
grant execute on function public.adjust_loyalty_points(int, int) to authenticated;
