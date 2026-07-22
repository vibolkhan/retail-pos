-- Turn products."batchUnit" (free text) into a proper FK to batch_units,
-- same shape as categoryId. The old text column is kept (unused going
-- forward) rather than dropped, matching this schema's preference for
-- preserving history over destructive changes.
alter table public.products add column "batchUnitId" integer references public.batch_units(id);

insert into public.batch_units (name, unit)
select distinct "batchUnit", "batchUnit"
from public.products
where "batchUnit" is not null and trim("batchUnit") <> ''
on conflict (name) do nothing;

update public.products p
set "batchUnitId" = bu.id
from public.batch_units bu
where p."batchUnit" = bu.name and p."batchUnitId" is null;
