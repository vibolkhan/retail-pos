export const DEFAULT_LOW_STOCK_THRESHOLD = 5

export function isLowStock (stock: number, threshold?: number | null): boolean {
  return stock <= (threshold ?? DEFAULT_LOW_STOCK_THRESHOLD)
}
