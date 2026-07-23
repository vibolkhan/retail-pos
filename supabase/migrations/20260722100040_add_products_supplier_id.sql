-- Links a product to its default/primary supplier — same shape as
-- categoryId/batchUnitId: a simple nullable FK, not a join table. One
-- supplier per product is enough to let Purchases filter/bulk-add a
-- supplier's catalog; products with no supplier assigned yet stay
-- pickable individually, same as before this migration.
alter table public.products add column "supplierId" integer references public.suppliers(id);
