/**
 * Recurring-payment & subscription detection, duplicate detection and data-quality checks.
 * Detection only SUGGESTS — nothing is converted into a recurring rule without user confirmation.
 */
import type { Frequency, RecurringRule, Transaction } from './types'
import { isCounted, round2 } from './aggregate'
import { diffDays, isValidDateKey, todayKey, addDays } from './dates'
import { TRANSACTION_TYPES } from './types'

export interface RecurringSuggestion {
  key: string
  merchant: string
  category: string
  type: Transaction['type']
  averageAmount: number
  frequency: Frequency
  intervalDays: number
  occurrences: number
  lastDate: string
  transactionIds: string[]
  isSubscription: boolean
}

const SUBSCRIPTION_HINTS = /netflix|spotify|youtube|prime|disney|apple|icloud|google ?(one|storage)|dropbox|onedrive|microsoft|office ?365|adobe|chatgpt|openai|claude|canva|notion|gym|fitness|dialog|mobitel|hutch|airtel|slt|internet|broadband|subscription|membership|cloud|software|saas/i

export const normalizeMerchant = (s: string | undefined) =>
  (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(pvt|ltd|plc|inc|llc|co|the)\b/g, '').replace(/\s+/g, ' ').trim()

function classify(intervalDays: number): Frequency | null {
  if (intervalDays >= 6 && intervalDays <= 8) return 'weekly'
  if (intervalDays >= 13 && intervalDays <= 16) return 'biweekly'
  if (intervalDays >= 26 && intervalDays <= 35) return 'monthly'
  if (intervalDays >= 85 && intervalDays <= 97) return 'quarterly'
  if (intervalDays >= 170 && intervalDays <= 195) return 'semiannual'
  if (intervalDays >= 350 && intervalDays <= 380) return 'annual'
  return null
}

export function detectRecurring(txs: Transaction[], existingRules: RecurringRule[] = [], dismissed: string[] = []): RecurringSuggestion[] {
  const known = new Set(existingRules.map(r => normalizeMerchant(r.merchant || r.description)))
  const groups = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (!isCounted(t) || t.recurrenceId || !(t.type === 'expense' || t.type === 'income')) continue
    const m = normalizeMerchant(t.merchant || t.description)
    if (!m) continue
    const key = `${t.type}:${m}`
    const a = groups.get(key) || []; a.push(t); groups.set(key, a)
  }
  const out: RecurringSuggestion[] = []
  for (const [key, list] of groups) {
    if (list.length < 3 || dismissed.includes(key)) continue
    const merchant = key.split(':').slice(1).join(':')
    if (known.has(merchant)) continue
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) gaps.push(diffDays(sorted[i - 1].date, sorted[i].date))
    const medianGap = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    const freq = classify(medianGap)
    if (!freq) continue
    const consistent = gaps.filter(g => Math.abs(g - medianGap) <= Math.max(3, medianGap * 0.15)).length / gaps.length
    const amounts = sorted.map(t => t.amount)
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const amountStable = amounts.every(a => Math.abs(a - avg) <= Math.max(50, avg * 0.2))
    if (consistent < 0.7 || !amountStable) continue
    const last = sorted[sorted.length - 1]
    out.push({
      key,
      merchant: last.merchant || last.description || merchant,
      category: last.category,
      type: last.type,
      averageAmount: round2(avg),
      frequency: freq,
      intervalDays: medianGap,
      occurrences: sorted.length,
      lastDate: last.date,
      transactionIds: sorted.map(t => t.id),
      isSubscription: last.category === 'subscriptions' || SUBSCRIPTION_HINTS.test(`${last.merchant} ${last.description}`),
    })
  }
  return out.sort((a, b) => b.occurrences - a.occurrences)
}

export function subscriptionSpend(txs: Transaction[], start: string, end: string): { total: number; items: Transaction[] } {
  const items = txs.filter(t => isCounted(t) && t.type === 'expense' && t.date >= start && t.date <= end &&
    (t.category === 'subscriptions' || SUBSCRIPTION_HINTS.test(`${t.merchant || ''} ${t.description || ''}`)))
  return { total: round2(items.reduce((s, t) => s + t.amount, 0)), items }
}

// ───────────────────────── Duplicates ─────────────────────────

export function duplicateKey(t: Pick<Transaction, 'type' | 'amount' | 'date' | 'merchant' | 'description' | 'accountId'>): string {
  return [t.type, round2(t.amount), t.date, normalizeMerchant(t.merchant || t.description), t.accountId || ''].join('|')
}

/** Returns candidates that look like duplicates of `t` (same type & amount, same/adjacent day, similar merchant). */
export function findDuplicates(t: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>, existing: Transaction[]): Transaction[] {
  const m = normalizeMerchant(t.merchant || t.description)
  return existing.filter(e =>
    e.id !== t.id && isCounted(e) && e.type === t.type && round2(e.amount) === round2(t.amount) &&
    Math.abs(diffDays(e.date, t.date)) <= 1 &&
    (!m || !normalizeMerchant(e.merchant || e.description) || normalizeMerchant(e.merchant || e.description) === m))
}

/** For imports: split incoming rows into new vs probable duplicates (also de-duplicates within the batch). */
export function partitionDuplicates<T extends Pick<Transaction, 'type' | 'amount' | 'date' | 'merchant' | 'description' | 'accountId'>>(incoming: T[], existing: Transaction[]) {
  const seen = new Set(existing.filter(isCounted).map(duplicateKey))
  const fresh: T[] = [], dupes: T[] = []
  for (const r of incoming) {
    const k = duplicateKey(r)
    if (seen.has(k)) dupes.push(r)
    else { fresh.push(r); seen.add(k) }
  }
  return { fresh, dupes }
}

// ───────────────────────── Validation / data quality ─────────────────────────

export interface ValidationIssue { field: string; message: string; severity: 'error' | 'warning' }

export const MAX_AMOUNT = 1_000_000_000 // Rs. 1bn — hard sanity cap

export function validateTransaction(t: Partial<Transaction>, opts: { today?: string; typicalMax?: number } = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const today = opts.today || todayKey()
  if (!t.type || !TRANSACTION_TYPES.includes(t.type)) issues.push({ field: 'type', message: 'Unknown transaction type', severity: 'error' })
  const amt = Number(t.amount)
  if (t.type === 'adjustment') {
    if (!isFinite(amt) || amt === 0) issues.push({ field: 'amount', message: 'Adjustment amount cannot be zero', severity: 'error' })
  } else if (!isFinite(amt) || amt <= 0) issues.push({ field: 'amount', message: 'Amount must be greater than zero', severity: 'error' })
  if (Math.abs(amt) > MAX_AMOUNT) issues.push({ field: 'amount', message: 'Amount is unrealistically large', severity: 'error' })
  if (!isValidDateKey(t.date)) issues.push({ field: 'date', message: 'Invalid date', severity: 'error' })
  else {
    if (t.date! > addDays(today, 366)) issues.push({ field: 'date', message: 'Date is more than a year in the future', severity: 'error' })
    else if (t.date! > today) issues.push({ field: 'date', message: 'Date is in the future', severity: 'warning' })
    if (t.date! < '1970-01-01') issues.push({ field: 'date', message: 'Date is too far in the past', severity: 'error' })
  }
  if (!t.category && t.type !== 'transfer' && t.type !== 'adjustment') issues.push({ field: 'category', message: 'Missing category', severity: 'warning' })
  if (t.type === 'transfer') {
    if (!t.accountId || !t.toAccountId) issues.push({ field: 'toAccountId', message: 'Transfers need both a source and destination account', severity: 'error' })
    else if (t.accountId === t.toAccountId) issues.push({ field: 'toAccountId', message: 'Source and destination accounts must differ', severity: 'error' })
  }
  if (opts.typicalMax && amt > opts.typicalMax * 5 && amt > 10000) {
    issues.push({ field: 'amount', message: `Unusually large compared with your typical transactions (≈${Math.round(opts.typicalMax).toLocaleString()})`, severity: 'warning' })
  }
  return issues
}

export interface DataQualityReport {
  missingCategory: Transaction[]
  invalid: { tx: Transaction; issues: ValidationIssue[] }[]
  suspicious: Transaction[]
  duplicateGroups: Transaction[][]
}

export function dataQuality(txs: Transaction[], today = todayKey()): DataQualityReport {
  const counted = txs.filter(isCounted)
  const exp = counted.filter(t => t.type === 'expense').map(t => t.amount).sort((a, b) => a - b)
  const p95 = exp.length >= 20 ? exp[Math.floor(exp.length * 0.95)] : undefined
  const invalid: DataQualityReport['invalid'] = []
  for (const t of counted) {
    const issues = validateTransaction(t, { today }).filter(i => i.severity === 'error')
    if (issues.length) invalid.push({ tx: t, issues })
  }
  const groups = new Map<string, Transaction[]>()
  for (const t of counted) { const k = duplicateKey(t); const a = groups.get(k) || []; a.push(t); groups.set(k, a) }
  return {
    missingCategory: counted.filter(t => !t.category && t.type !== 'transfer' && t.type !== 'adjustment'),
    invalid,
    suspicious: p95 ? counted.filter(t => t.type === 'expense' && t.amount > p95 * 5) : [],
    duplicateGroups: [...groups.values()].filter(g => g.length > 1 && !g.every(x => x.recurrenceId)),
  }
}
