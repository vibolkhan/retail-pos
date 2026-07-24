-- Cost of goods and sale price become single global values per product
-- (was per-branch on branch_stock.cost, added in 20260722100000 and now
-- being removed in 20260723100030). New descriptive fields for a mart-style
-- catalog: description, brand, expiry date, and a per-product low-stock
-- alert threshold (falls back to a client-side default when null).
alter table public.products
  add column cost numeric,
  add column description text not null default '',
  add column brand text,
  add column "expiryDate" timestamptz,
  add column "lowStockThreshold" integer;

alter table public.products
  add constraint products_cost_nonneg check (cost is null or cost >= 0);

alter table public.products
  add constraint products_low_stock_threshold_nonneg
    check ("lowStockThreshold" is null or "lowStockThreshold" >= 0);

-- Backfill products.cost from branch_stock.cost. A product could have had
-- different costs at its retail vs wholesale branch — prefer the retail
-- branch's value, fall back to any other branch's (i.e. wholesale), else
-- leave null.
with preferred_cost as (
  select distinct on (bs."productId")
    bs."productId",
    bs.cost
  from public.branch_stock bs
  join public.branches b on b.id = bs."branchId"
  where bs.cost is not null
  order by bs."productId", (b.type = 'retail') desc, b.id asc
)
update public.products p
set cost = pc.cost
from preferred_cost pc
where p.id = pc."productId";
