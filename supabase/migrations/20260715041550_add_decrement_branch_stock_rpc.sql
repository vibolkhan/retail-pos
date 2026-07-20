-- Decrements per-branch stock at checkout. SECURITY DEFINER so salespersons
-- can decrement even though branch_stock writes are otherwise admin-only.
-- Clamps at 0: a completed payment must never fail on a stock race.
create or replace function public.decrement_branch_stock(p_branch_id int, p_items jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update branch_stock bs
  set stock = greatest(bs.stock - i.quantity, 0)
  from jsonb_to_recordset(p_items) as i("productId" int, quantity int)
  where bs."productId" = i."productId"
    and bs."branchId" = p_branch_id;
$$;

revoke execute on function public.decrement_branch_stock(int, jsonb) from public, anon;
grant execute on function public.decrement_branch_stock(int, jsonb) to authenticated;
