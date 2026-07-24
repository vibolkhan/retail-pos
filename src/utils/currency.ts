const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function formatCurrency (value: number) {
  return currencyFormatter.format(value)
}

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

// Formats a ratio (e.g. 0.15 -> "15%"), as used for margin figures across
// Purchase/Inventory/Profit & Loss.
export function formatPercent (ratio: number) {
  return percentFormatter.format(ratio)
}

const secondaryFormatters = new Map<string, Intl.NumberFormat>()

// Formats an amount that's already denominated in the given currency code
// (no conversion) — e.g. an aggregate that was converted sale-by-sale at
// each sale's own historical rate before summing.
export function formatCurrencyAs (amount: number, currencyCode: string) {
  let formatter = secondaryFormatters.get(currencyCode)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode })
    secondaryFormatters.set(currencyCode, formatter)
  }
  return formatter.format(amount)
}

// Converts a base-currency amount to a secondary currency at the given rate
// and formats it (e.g. formatSecondaryCurrency(12, 'KHR', 4100) -> "៛49,200").
// Returns '' when there's no rate configured, so callers can just `v-if` it.
export function formatSecondaryCurrency (amount: number, currencyCode: string, rate: number | null | undefined) {
  if (!rate) {
    return ''
  }
  return formatCurrencyAs(amount * rate, currencyCode)
}
