-- Stock now lives exclusively in branch_stock
alter table public.products drop column stock;

-- Every sale must belong to a branch
alter table public.sales alter column "branchId" set not null;
