-- Last unit cost paid for a product at a specific branch. Branch-scoped
-- (not on products) because retail vs wholesale branches can have genuinely
-- different landed costs for the same product. Null until the product has
-- ever been purchased into that branch — Excel-imported/manually-stocked
-- rows stay null (only the Purchase flow ever writes this column).
alter table public.branch_stock add column cost numeric;
