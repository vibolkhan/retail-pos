-- Retail-vs-wholesale selling distinction removed entirely: every product
-- now sells the same way everywhere, at its one unit/price/cost. Archive
-- the columns being dropped first (cheap insurance for 1040 rows, in case
-- the old retail/wholesale/batch-pricing history is ever needed for audit
-- — safe to drop this archive table later once confident it's not needed).
create table public.products_pre_simplification_archive as
select id, "sellableRetail", "sellableWholesale", "batchSize", "batchPrice", "batchUnit"
from public.products;

alter table public.products
  drop column "sellableRetail",
  drop column "sellableWholesale",
  drop column "batchSize",
  drop column "batchPrice",
  drop column "batchUnit";
