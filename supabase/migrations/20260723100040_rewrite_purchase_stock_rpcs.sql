-- Cost of goods moved from branch_stock (per-branch) to products (global,
-- see 20260723100000/20260723100030) — these RPCs now update branch_stock
-- for STOCK only, and products for COST only.
--
-- Tradeoff (accepted, wider now than before): stock reversal on void is
-- still always correct (pure additive inverse of what this purchase
-- added). Cost reversal is NOT order-independent, and this is now a
-- product-global concern rather than a per-branch one — voiding an older
-- purchase while a NEWER purchase of the same product at ANY branch is
-- still active will overwrite the newer, currently-correct cost back to
-- the older value with no error. The Purchase page's void flow surfaces a
-- client-side warning for this case (checking already-loaded purchase
-- history across all branches, not just the same one).
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
    insert into branch_stock ("productId", "branchId", stock)
    values (item."productId", p_branch_id, 0)
    on conflict ("productId", "branchId") do nothing;

    -- Cost is global per product now: lock the products row and read its
    -- current cost BEFORE overwriting, same previousCost mechanic as
    -- before, just re-scoped from branch_stock to products.
    select cost into prev_cost
    from products
    where id = item."productId"
    for update;

    update branch_stock
    set stock = stock + item.quantity
    where "productId" = item."productId" and "branchId" = p_branch_id;

    update products
    set cost = item."unitCost"
    where id = item."productId";

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

  -- Stock reversal: unchanged, still branch-scoped.
  update branch_stock bs
  set stock = greatest(bs.stock - i.quantity, 0)
  from jsonb_to_recordset(p_items) as i("productId" int, quantity int)
  where bs."productId" = i."productId"
    and bs."branchId" = p_branch_id;

  -- Cost reversal: now global per product, not per product+branch.
  update products p
  set cost = i."previousCost"
  from jsonb_to_recordset(p_items) as i("productId" int, "previousCost" numeric)
  where p.id = i."productId";
end;
$$;
