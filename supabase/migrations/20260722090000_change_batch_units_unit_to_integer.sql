-- The "unit" field on batch_units is really a quantity (how many retail
-- units make up one batch of this preset, e.g. "Case" = 12), not a short
-- text label — the existing values are already numeric strings ("12",
-- "60", "24"), so this is a straight cast, no data-loss backfill needed.
alter table public.batch_units alter column unit type integer using unit::integer;
alter table public.batch_units add constraint batch_units_unit_positive check (unit > 0);
