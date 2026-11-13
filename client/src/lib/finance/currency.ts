/**
 * Multi-currency support.
 *
 * Every transaction keeps its ORIGINAL amount + currency. When the currency differs from the
 * user's base currency, `fxRate` (1 unit of the transaction currency = fxRate base units) and
 * `baseAmount` are frozen at save time, so historical totals never move when rates change.
 * All totals, budgets, balances and reports are computed in the base currency.
 */
import type { Transaction } from './types'
import { round2 } from './aggregate'

export const CURRENCY_LIST: { code: string; symbol: string; name: string }[] = [
  { code: 'LKR', symbol: 'Rs.', name: 'Sri Lankan Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese Yuan' },
  { code: 'MVR', symbol: 'Rf', name: 'Maldivian Rufiyaa' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal' },
  { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
]

export const currencySymbol = (code: string | undefined) => CURRENCY_LIST.find(c => c.code === code)?.symbol || code || ''

/** rates: 1 unit of `code` = rates[code] units of the base currency. */
export type FxRates = Record<string, number>

export function rateFor(currency: string, base: string, rates: FxRates): number | null {
  if (!currency || currency === base) return 1
  const r = Number(rates?.[currency])
  return isFinite(r) && r > 0 ? r : null
}

export function toBase(amount: number, currency: string, base: string, rates: FxRates): number | null {
  const r = rateFor(currency, base, rates)
  return r == null ? null : round2(amount * r)
}

/**
 * Fill `fxRate` / `baseAmount` for a transaction being saved. Throws when a foreign-currency
 * transaction has no usable rate (the form asks the user for one).
 */
export function withBaseAmount<T extends { amount: number; currency: string; fxRate?: number; baseAmount?: number }>(t: T, base: string, rates: FxRates): T {
  if (!t.currency || t.currency === base) {
    // explicit undefined → removed from the stored doc on update
    return { ...t, currency: base, fxRate: undefined, baseAmount: undefined }
  }
  const rate = t.fxRate && t.fxRate > 0 ? t.fxRate : rateFor(t.currency, base, rates)
  if (!rate) throw new Error(`No exchange rate for ${t.currency} → ${base}. Enter a rate.`)
  return { ...t, fxRate: rate, baseAmount: round2(Math.abs(t.amount) * rate) * Math.sign(t.amount || 1) }
}

/**
 * In-memory view used by every calculation: `amount` becomes the base-currency value and the
 * original is kept in `originalAmount`. Stored documents are never changed by this.
 */
export function normalizeToBase(t: Transaction): Transaction {
  if (t.baseAmount == null || t.originalAmount != null) return t
  return { ...t, originalAmount: t.amount, amount: t.baseAmount }
}

/** Convert rates from an API that quotes "1 base = X foreign" into our "1 foreign = Y base". */
export function invertRates(perBase: Record<string, number>, codes: string[]): FxRates {
  const out: FxRates = {}
  for (const c of codes) { const v = perBase[c]; if (v && v > 0) out[c] = Math.round((1 / v) * 1e6) / 1e6 }
  return out
}
