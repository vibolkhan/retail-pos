// Color for a margin ratio (e.g. (price - cost) / price) — shared between
// Inventory's Margin column and Purchase's per-line margin preview, since
// both compare the same product's cost against its one sell price now.
export function marginColor (margin: number | null): 'grey' | 'error' | 'warning' | 'success' {
  if (margin == null) {
    return 'grey'
  }
  if (margin < 0) {
    return 'error'
  }
  if (margin < 0.15) {
    return 'warning'
  }
  return 'success'
}
