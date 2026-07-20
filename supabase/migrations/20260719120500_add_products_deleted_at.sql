-- Soft-delete for products: replaces the previous hard DELETE (which also
-- wiped branch_stock rows with no way back). Deleting now just sets this
-- timestamp; branch_stock rows are left untouched so a restore keeps stock.
alter table public.products add column "deletedAt" timestamptz;
