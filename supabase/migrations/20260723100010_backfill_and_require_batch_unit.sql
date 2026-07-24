-- Every product now needs exactly one unit (retail-vs-wholesale selling
-- distinction removed — see 20260723100020). None of the existing
-- batch_units rows (Box=12, Case=24, Carton=60) represents a single base
-- unit, so create one and backfill every product with no batchUnitId.
insert into public.batch_units (name, unit)
values ('Piece', 1)
on conflict (name) do nothing;

update public.products p
set "batchUnitId" = bu.id
from public.batch_units bu
where bu.name = 'Piece' and p."batchUnitId" is null;

alter table public.products
  alter column "batchUnitId" set not null;
