-- Atomically bumps branch_stock.stock and overwrites branch_stock.cost for
-- every line of a purchase, returning each line's cost *before* this
-- update (previousCost) so the caller can snapshot it into purchases.items
-- for a later void to restore exactly. SELECT ... FOR UPDATE locks each
-- row before reading its cost, so a concurrent purchase/void against the
-- same (productId, branchId) can't interleave between the read and write.
--
-- security definer (like decrement/increment_branch_stock) but, unlike
-- those, this must NOT be callable by a salesperson to freely inflate
-- stock/cost — purchases are always admin/manager-triggered, and
-- security definer bypasses RLS entirely, so each function opens with an
-- explicit is_admin_or_manager() guard.
create or replace function public.receive_purchase_stock(p_branch_id int, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  prev_cost numeric;
  result jsonb := '[]'::jsonb;
begin
  if not public.is_admin_or_manager() then
    raise exception 'Only admins or managers may receive purchase stock';
  end if;

  for item in
    select * from jsonb_to_recordset(p_items) as i("productId" int, quantity int, "unitCost" numeric)
  loop
    -- First-ever purchase of this product at this branch: make sure a row
    -- exists before locking/reading it.
    insert into branch_stock ("productId", "branchId", stock, cost)
    values (item."productId", p_branch_id, 0, null)
    on conflict ("productId", "branchId") do nothing;

    select cost into prev_cost
    from branch_stock
    where "productId" = item."productId" and "branchId" = p_branch_id
    for update;

    update branch_stock
    set stock = stock + item.quantity,
        cost = item."unitCost"
    where "productId" = item."productId" and "branchId" = p_branch_id;

    result := result || jsonb_build_object(
      'productId', item."productId",
      'quantity', item.quantity,
      'unitCost', item."unitCost",
      'previousCost', prev_cost
    );
  end loop;

  return result;
end;
$$;

revoke execute on function public.receive_purchase_stock(int, jsonb) from public, anon;
grant execute on function public.receive_purchase_stock(int, jsonb) to authenticated;

-- Reverses a voided purchase's stock/cost effects. Mirrors
-- increment_branch_stock's shape/clamp, plus restores cost from each
-- line's stored previousCost.
--
-- Tradeoff (accepted, not solved here): stock reversal is always correct
-- (pure additive inverse of what this purchase added). Cost reversal is
-- NOT order-independent — voiding an older purchase while a newer one on
-- the same (product, branch) is still active will overwrite the newer,
-- currently-correct cost back to the older value with no error. The
-- Purchase page's void flow surfaces a client-side warning for this case
-- (checking already-loaded purchase history) but still allows the void —
-- see the Purchase feature plan for the full rationale.
create or replace function public.void_purchase_stock(p_branch_id int, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_manager() then
    raise exception 'Only admins or managers may void purchase stock';
  end if;

  update branch_stock bs
  set stock = greatest(bs.stock - i.quantity, 0),
      cost = i."previousCost"
  from jsonb_to_recordset(p_items) as i("productId" int, quantity int, "previousCost" numeric)
  where bs."productId" = i."productId"
    and bs."branchId" = p_branch_id;
end;
$$;

revoke execute on function public.void_purchase_stock(int, jsonb) from public, anon;
grant execute on function public.void_purchase_stock(int, jsonb) to authenticated;
