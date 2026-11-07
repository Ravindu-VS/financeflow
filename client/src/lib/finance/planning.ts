/**
 * Planning & estimates — everything here is a PLAN or an ESTIMATE, never a fact.
 */
import type { Account, PeriodRange, RecurringRule, Transaction } from './types'
import { isLiabilityAccount, isSpendableAccount } from './types'
import { balanceEffects, isCounted, round2, summarize } from './aggregate'
import { addDays, diffDays, endOfMonth, startOfMonth } from './dates'
import { cycleMonths, monthlyEquivalent, occurrencesBetween } from './recurrence'

// ───────────────────────── Balances & net worth ─────────────────────────

/** Recompute balances from opening balances + every transaction (authoritative; used to repair cached balances). */
export function computeBalances(accounts: Account[], txs: Transaction[], upTo?: string): Record<string, number> {
  const bal: Record<string, number> = {}
  for (const a of accounts) bal[a.id] = Number(a.openingBalance) || 0
  for (const t of txs) {
    if (upTo && t.date > upTo) continue
    for (const e of balanceEffects(t)) {
      if (e.accountId in bal) bal[e.accountId] += e.delta
    }
  }
  for (const k in bal) bal[k] = round2(bal[k])
  return bal
}

/**
 * Balances as of the end of `date`, derived from CURRENT (cached) balances by reversing every
 * transaction dated after `date`. Exact as long as `txs` contains all transactions after `date`
 * (true for any date inside the live history window), and needs no full-history scan.
 */
export function balancesAsOf(current: Record<string, number>, txs: Transaction[], date: string): Record<string, number> {
  const bal: Record<string, number> = { ...current }
  for (const t of txs) {
    if (t.date <= date) continue
    for (const e of balanceEffects(t)) if (e.accountId in bal) bal[e.accountId] -= e.delta
  }
  for (const k in bal) bal[k] = round2(bal[k])
  return bal
}

export interface NetWorth { assets: number; liabilities: number; netWorth: number; byType: Record<string, number> }

/**
 * Net worth = assets − liabilities.
 *
 * Convention: liability accounts (credit card, loan) carry a NEGATIVE balance when money
 * is owed (spending on a credit card makes it more negative). The account form stores an
 * "amount owed" opening balance as a negative number. A positive liability balance (overpaid)
 * counts as an asset.
 *
 * Investment holdings from the Investments module are added at current market value
 * (`holdingsValue`). Investment transactions normally have no destination account, so
 * their cost basis is not double counted.
 */
export function netWorth(accounts: Account[], balances: Record<string, number>, holdingsValue = 0): NetWorth {
  let assets = 0, liabilities = 0
  const byType: Record<string, number> = {}
  for (const a of accounts) {
    if (a.archived) continue
    const b = balances[a.id] ?? a.balance ?? 0
    if (isLiabilityAccount(a.type) && b < 0) liabilities += -b
    else assets += b
    byType[a.type] = round2((byType[a.type] || 0) + b)
  }
  assets += holdingsValue
  if (holdingsValue) byType.holdings = round2(holdingsValue)
  return { assets: round2(assets), liabilities: round2(liabilities), netWorth: round2(assets - liabilities), byType }
}

export function availableCash(accounts: Account[], balances: Record<string, number>): number {
  let s = 0
  for (const a of accounts) {
    if (a.archived || !isSpendableAccount(a.type)) continue
    s += balances[a.id] ?? a.balance ?? 0
  }
  return round2(s)
}

// ───────────────────────── Cash flow statement ─────────────────────────

export interface CashFlowStatement {
  openingBalance: number
  income: number
  expenses: number
  refunds: number
  savings: number
  investments: number
  transfersIn: number
  transfersOut: number
  adjustments: number
  closingBalance: number
}

/**
 * Cash flow of SPENDABLE accounts for a period. opening + in − out = closing (verified in tests).
 * Pass `current` (cached balances) to derive opening/closing without the full history.
 */
export function cashFlowStatement(accounts: Account[], txs: Transaction[], r: PeriodRange, current?: Record<string, number>): CashFlowStatement {
  const spendable = new Set(accounts.filter(a => isSpendableAccount(a.type) && !a.archived).map(a => a.id))
  const opening = current ? balancesAsOf(current, txs, addDays(r.start, -1)) : computeBalances(accounts, txs, addDays(r.start, -1))
  const closing = current ? balancesAsOf(current, txs, r.end) : computeBalances(accounts, txs, r.end)
  const sum = (b: Record<string, number>) => round2([...spendable].reduce((s, id) => s + (b[id] || 0), 0))
  let transfersIn = 0, transfersOut = 0, adjustments = 0
  const inPeriod = txs.filter(t => isCounted(t) && t.date >= r.start && t.date <= r.end)
  for (const t of inPeriod) {
    if (t.type === 'transfer') {
      const fromS = t.accountId ? spendable.has(t.accountId) : false
      const toS = t.toAccountId ? spendable.has(t.toAccountId) : false
      if (fromS && !toS) transfersOut += t.amount
      if (!fromS && toS) transfersIn += t.amount
    }
    if (t.type === 'adjustment' && t.accountId && spendable.has(t.accountId)) adjustments += Number(t.amount) || 0
  }
  const s = summarize(inPeriod)
  return {
    openingBalance: sum(opening),
    income: s.income,
    expenses: s.expenses,
    refunds: s.refunds,
    savings: s.savings,
    investments: s.investments,
    transfersIn: round2(transfersIn),
    transfersOut: round2(transfersOut),
    adjustments: round2(adjustments),
    closingBalance: sum(closing),
  }
}

// ───────────────────────── Non-monthly expense provisions ─────────────────────────

export interface Provision { rule: RecurringRule; cycleMonths: number; monthlyProvision: number; nextDue: string | null; monthsUntilDue: number | null }

/**
 * For expenses that do not occur monthly (annual insurance, 6-monthly service…),
 * recommend a monthly set-aside. This is a PLANNING figure — it is never recorded as an expense.
 */
export function nonMonthlyProvisions(rules: RecurringRule[], today: string): Provision[] {
  return rules
    .filter(r => r.active && r.type === 'expense' && cycleMonths(r) > 1.01)
    .map(r => {
      const next = occurrencesBetween(r, today, addDays(today, 3660), 1)[0] || null
      return {
        rule: r,
        cycleMonths: round2(cycleMonths(r)),
        monthlyProvision: round2(monthlyEquivalent(r)),
        nextDue: next,
        monthsUntilDue: next ? round2(diffDays(today, next) / 30.4375) : null,
      }
    })
    .sort((a, b) => (a.nextDue || '9').localeCompare(b.nextDue || '9'))
}

// ───────────────────────── Safe to spend ─────────────────────────

export interface SafeToSpendInput {
  availableCash: number
  rules: RecurringRule[]
  today: string
  /** Planned savings still to contribute this month. */
  savingsCommitment: number
  /** Planned investments still to make this month. */
  investmentCommitment: number
  emergencyReserve: number
  /** Expected income still to arrive this month (from recurring income rules). Not counted by default (conservative). */
  includeExpectedIncome?: boolean
}

export interface SafeToSpendResult {
  availableCash: number
  upcomingBills: number
  upcomingBillItems: { description: string; date: string; amount: number }[]
  savingsCommitment: number
  investmentCommitment: number
  emergencyReserve: number
  expectedIncome: number
  safeToSpend: number
  daysLeft: number
  dailyLimit: number
  isEstimate: true
}

export function safeToSpend(i: SafeToSpendInput): SafeToSpendResult {
  const monthEnd = endOfMonth(i.today)
  const items: { description: string; date: string; amount: number }[] = []
  let expectedIncome = 0
  for (const r of i.rules) {
    if (!r.active) continue
    // occurrences from today to month end that have NOT been generated yet
    const from = r.lastGeneratedDate && r.lastGeneratedDate >= i.today ? addDays(r.lastGeneratedDate, 1) : i.today
    const occ = occurrencesBetween(r, from, monthEnd, 40)
    for (const d of occ) {
      if (r.type === 'expense' && (r.isBill || r.isEssential)) items.push({ description: r.description, date: d, amount: r.amount })
      if (r.type === 'income') expectedIncome += r.amount
    }
  }
  const upcomingBills = round2(items.reduce((s, x) => s + x.amount, 0))
  const raw = i.availableCash - upcomingBills - i.savingsCommitment - i.investmentCommitment - i.emergencyReserve
    + (i.includeExpectedIncome ? expectedIncome : 0)
  const sts = round2(Math.max(0, raw))
  const daysLeft = diffDays(i.today, monthEnd) + 1
  return {
    availableCash: round2(i.availableCash),
    upcomingBills,
    upcomingBillItems: items.sort((a, b) => a.date.localeCompare(b.date)),
    savingsCommitment: round2(i.savingsCommitment),
    investmentCommitment: round2(i.investmentCommitment),
    emergencyReserve: round2(i.emergencyReserve),
    expectedIncome: round2(expectedIncome),
    safeToSpend: sts,
    daysLeft,
    dailyLimit: round2(sts / Math.max(1, daysLeft)),
    isEstimate: true,
  }
}

// ───────────────────────── Forecasts ─────────────────────────

export interface Forecast { expected: number; low: number; high: number; confidence: 'low' | 'medium' | 'high'; basis: string }

/**
 * Month-end expense forecast for the month containing `today`.
 * Combines: actual-so-far + known remaining bills + variable spending pace
 * (blend of this month's daily pace and historical daily average).
 * Uncertainty band from historical month-to-month variability.
 */
export function forecastMonthExpenses(txs: Transaction[], rules: RecurringRule[], today: string): Forecast {
  const mStart = startOfMonth(today), mEnd = endOfMonth(today)
  const elapsed = diffDays(mStart, today) + 1
  const total = diffDays(mStart, mEnd) + 1
  const remainingDays = total - elapsed
  const cur = txs.filter(t => isCounted(t) && t.date >= mStart && t.date <= today)
  const recurringIds = new Set(rules.map(r => r.id))
  const actual = summarize(cur).netExpenses
  // Only habitual spending is extrapolated; one-off / unexpected / emergency items and recurring bills are counted once.
  const isOneOff = (t: Transaction) => t.kind === 'one_time' || t.kind === 'unexpected' || t.kind === 'emergency'
  const variableSoFar = summarize(cur.filter(t => !isOneOff(t) && (!t.recurrenceId || !recurringIds.has(t.recurrenceId)))).netExpenses

  // history: previous up-to-6 full months
  const hist: number[] = []
  const histVariable: number[] = []
  for (let i = 1; i <= 6; i++) {
    const s = shiftMonthKey(mStart, -i), e = endOfMonth(s)
    const m = txs.filter(t => isCounted(t) && t.date >= s && t.date <= e)
    if (!m.length) continue
    hist.push(summarize(m).netExpenses)
    histVariable.push(summarize(m.filter(t => !t.recurrenceId && !isOneOff(t))).netExpenses)
  }
  const histDaily = histVariable.length ? histVariable.reduce((a, b) => a + b, 0) / histVariable.length / 30.4375 : 0
  const curDaily = variableSoFar / elapsed
  const w = Math.min(1, elapsed / total + 0.25) // trust this month's pace more as the month progresses
  const pace = histVariable.length ? w * curDaily + (1 - w) * histDaily : curDaily

  let remainingBills = 0
  for (const r of rules) {
    if (!r.active || r.type !== 'expense') continue
    remainingBills += occurrencesBetween(r, addDaysSafe(today, 1), mEnd, 40).length * r.amount
  }
  const expected = actual + pace * remainingDays + remainingBills
  const sd = stdev(hist)
  const mean = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : expected
  const cv = mean > 0 ? sd / mean : 0.5
  const spread = expected * Math.max(0.05, Math.min(0.6, cv)) * (remainingDays / total + 0.1)
  const confidence: Forecast['confidence'] = hist.length >= 4 && cv < 0.2 ? 'high' : hist.length >= 2 ? 'medium' : 'low'
  return {
    expected: round2(expected),
    low: round2(Math.max(actual, expected - spread)),
    high: round2(expected + spread),
    confidence,
    basis: `Actual so far ${round2(actual)} + ${remainingDays} days at ~${round2(pace)}/day + ${round2(remainingBills)} known recurring. Based on ${hist.length} month(s) of history.`,
  }
}

/**
 * Category budget forecast: "at your current rate you may exceed by X".
 * `oneOffSoFar` (one-time / unexpected spending) is added once, never extrapolated.
 */
export function forecastCategory(spentSoFar: number, today: string, histMonthlyAvg?: number, oneOffSoFar = 0): number {
  const mStart = startOfMonth(today), mEnd = endOfMonth(today)
  const elapsed = diffDays(mStart, today) + 1
  const total = diffDays(mStart, mEnd) + 1
  const habitual = Math.max(0, spentSoFar - oneOffSoFar)
  const pace = habitual / elapsed * total + oneOffSoFar
  if (histMonthlyAvg == null || histMonthlyAvg <= 0) return round2(pace)
  const w = elapsed / total
  return round2(Math.max(spentSoFar, w * pace + (1 - w) * (histMonthlyAvg + oneOffSoFar)))
}

export function goalRequiredMonthly(target: number, current: number, deadline: string | undefined, today: string): { remaining: number; months: number; perMonth: number } {
  const remaining = Math.max(0, target - current)
  if (!deadline) return { remaining: round2(remaining), months: 0, perMonth: 0 }
  const months = Math.max(1, Math.ceil(diffDays(today, deadline) / 30.4375))
  return { remaining: round2(remaining), months, perMonth: round2(remaining / months) }
}

function stdev(xs: number[]) {
  if (xs.length < 2) return 0
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}
function shiftMonthKey(monthStart: string, n: number) {
  const [y, m] = monthStart.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1, 12)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function addDaysSafe(k: string, n: number) { return addDays(k, n) }
