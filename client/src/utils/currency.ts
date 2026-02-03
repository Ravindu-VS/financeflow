// Currency configuration for Sri Lankan Rupee (LKR)
export const CURRENCY = {
  code: 'LKR',
  symbol: 'Rs.',
  locale: 'en-LK'
}

/**
 * Format a number as currency with the Sri Lankan Rupee symbol
 */
export function formatCurrency(amount: number): string {
  return `${CURRENCY.symbol} ${amount.toLocaleString('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

/**
 * Format a number as compact currency (e.g., Rs. 10k, Rs. 1.5M)
 */
export function formatCompactCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `${CURRENCY.symbol} ${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `${CURRENCY.symbol} ${(amount / 1000).toFixed(0)}k`
  }
  return formatCurrency(amount)
}

/**
 * Format currency for charts/axis labels (shorter format)
 */
export function formatAxisCurrency(value: number): string {
  if (value >= 1000000) {
    return `${CURRENCY.symbol}${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${CURRENCY.symbol}${(value / 1000).toFixed(0)}k`
  }
  return `${CURRENCY.symbol}${value}`
}

/**
 * Get currency label for form inputs
 */
export function getCurrencyLabel(label: string): string {
  return `${label} (${CURRENCY.symbol})`
}
