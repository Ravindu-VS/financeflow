import type { Frequency, RecurringRule, Transaction } from './types'
import { addDays, addMonths, parseDateKey, todayKey } from './dates'

export const FREQUENCIES: { value: Frequency; label: string; months?: number; days?: number }[] = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'biweekly', label: 'Every 2 weeks', days: 14 },
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'quarterly', label: 'Quarterly', months: 3 },
  { value: 'semiannual', label: 'Every 6 months', months: 6 },
  { value: 'annual', label: 'Annually', months: 12 },
  { value: 'custom', label: 'Custom' },
]

export function frequencyLabel(r: Pick<RecurringRule, 'frequency' | 'interval' | 'customUnit'>): string {
  if (r.frequency !== 'custom') return FREQUENCIES.find(f => f.value === r.frequency)?.label || r.frequency
  const n = r.interval || 1
  return `Every ${n} ${r.customUnit || 'month'}${n > 1 ? 's' : ''}`
}

/** Step size of a rule, expressed either in days or in months. */
function step(rule: Pick<RecurringRule, 'frequency' | 'interval' | 'customUnit'>): { days?: number; months?: number } {
  if (rule.frequency === 'custom') {
    const n = Math.max(1, Math.floor(rule.interval || 1))
    switch (rule.customUnit) {
      case 'day': return { days: n }
      case 'week': return { days: 7 * n }
      case 'year': return { months: 12 * n }
      default: return { months: n }
    }
  }
  const f = FREQUENCIES.find(x => x.value === rule.frequency)!
  return f.days ? { days: f.days } : { months: f.months }
}

/** Average length of one cycle in months (used for provisioning & monthly-equivalent maths). */
export function cycleMonths(rule: Pick<RecurringRule, 'frequency' | 'interval' | 'customUnit'>): number {
  const s = step(rule)
  return s.months ?? (s.days! / 30.4375)
}

/** Monthly-equivalent amount of a rule (salary weekly → ×4.35 etc.). */
export function monthlyEquivalent(rule: Pick<RecurringRule, 'amount' | 'frequency' | 'interval' | 'customUnit'>): number {
  return rule.amount / cycleMonths(rule)
}

/**
 * All occurrence dates of a rule within [from, to] inclusive.
 * Month-based rules keep the anchor day of `startDate` (31st → last day of short months).
 * Skipped dates are excluded. Safe upper bound prevents runaway loops.
 */
export function occurrencesBetween(rule: RecurringRule, from: string, to: string, maxCount = 1000): string[] {
  const out: string[] = []
  if (!rule.startDate || to < rule.startDate) return out
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to
  const s = step(rule)
  const anchorDay = parseDateKey(rule.startDate).getDate()
  const skipped = new Set(rule.skippedDates || [])
  let i = 0
  let k = rule.startDate
  // Fast-forward day-based rules
  if (s.days && from > rule.startDate) {
    const gap = Math.floor((parseDateKey(from).getTime() - parseDateKey(rule.startDate).getTime()) / 86400000 / s.days)
    i = Math.max(0, gap - 1)
    k = addDays(rule.startDate, i * s.days)
  }
  let guard = 0
  while (k <= end && guard++ < 100000) {
    if (k >= from && !skipped.has(k)) {
      out.push(k)
      if (out.length >= maxCount) break
    }
    i++
    k = s.days ? addDays(rule.startDate, i * s.days) : addMonths(rule.startDate, i * s.months!, anchorDay)
  }
  return out
}

export function nextOccurrence(rule: RecurringRule, after: string = todayKey()): string | null {
  const next = occurrencesBetween(rule, after, addMonths(after, 120), 1)
  return next[0] || null
}

/**
 * Occurrences that should be materialised as real transactions:
 * active + autoGenerate rules, from the day after lastGeneratedDate up to `today`.
 * Deterministic ids make generation idempotent (re-running never duplicates).
 */
export function pendingOccurrences(rule: RecurringRule, today: string = todayKey()): string[] {
  if (!rule.active || !rule.autoGenerate) return []
  const from = rule.lastGeneratedDate ? addDays(rule.lastGeneratedDate, 1) : rule.startDate
  if (from > today) return []
  return occurrencesBetween(rule, from, today, 366)
}

export function occurrenceId(ruleId: string, dateKey: string): string {
  return `rec_${ruleId}_${dateKey.replace(/-/g, '')}`
}

/** Build the concrete transaction for one occurrence. The result is independent of the rule afterwards. */
export function buildOccurrence(rule: RecurringRule, dateKey: string): Transaction {
  return {
    id: occurrenceId(rule.id, dateKey),
    type: rule.type,
    amount: rule.amount,
    currency: rule.currency,
    date: dateKey,
    category: rule.category,
    subcategory: rule.subcategory,
    description: rule.description,
    merchant: rule.merchant,
    accountId: rule.accountId,
    toAccountId: rule.toAccountId,
    recurrenceId: rule.id,
    isEssential: rule.isEssential,
    nature: rule.variableAmount ? 'variable' : 'fixed',
    kind: 'regular',
    status: 'cleared',
    source: 'recurring',
  }
}

/** Upcoming (virtual, not stored) occurrences across rules within the next `days` days. */
export function upcomingOccurrences(rules: RecurringRule[], from: string, days: number): { rule: RecurringRule; date: string }[] {
  const to = addDays(from, days)
  const out: { rule: RecurringRule; date: string }[] = []
  for (const r of rules) {
    if (!r.active) continue
    for (const d of occurrencesBetween(r, from, to, 50)) out.push({ rule: r, date: d })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
