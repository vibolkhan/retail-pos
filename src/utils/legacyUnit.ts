// Historical sales/purchases rows are stored as jsonb — the TypeScript
// types no longer declare `uom`/`batchUnit`/`batchSize`, but rows written
// before this migration (and carts already sitting in a browser's
// localStorage across the deploy) still carry those keys forever, since no
// migration touches historical jsonb data. Prefer the new `unitName`; fall
// back to the legacy `batchUnit` string when present; render nothing for
// old plain-retail lines (no batchUnit), matching their pre-migration
// display exactly instead of showing "undefined".
export function legacyUnitLabel (item: { unitName?: string | null }): string {
  if (item.unitName) {
    return item.unitName
  }
  const legacy = (item as { batchUnit?: unknown }).batchUnit
  return typeof legacy === 'string' && legacy ? legacy : ''
}
