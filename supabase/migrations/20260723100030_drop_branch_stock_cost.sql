-- Cost is now product-level (products.cost, backfilled in
-- 20260723100000). Drop the branch-scoped column entirely.
alter table public.branch_stock drop column cost;
