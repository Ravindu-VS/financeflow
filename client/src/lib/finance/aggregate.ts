/**
 * Accounting model (single source of truth for every total in the app).
 *
 *  income                → +income
 *  expense               → +expenses
 *  refund/reimbursement  → reduces expenses (contra-expense), never counted as income
 *  savings_contribution  → +savings   (money moved to savings, NOT an expense)
 *  savings_withdrawal    → −savings
 *  investment            → +investments (asset purchase, NOT an expense)
 *  withdrawal            → −investments
 *  transfer / adjustment → excluded from income, expenses, savings and investments
 *
 *  netCashFlow          = income − netExpenses            (true surplus for the period)
 *  availableCashChange  = netCashFlow − savings − investments (change in spendable money)
 *  savingsRate          = (savings + investments) / income
 *  surplusRate          = netCashFlow / income
 *
 *  Voided transactions are ignored everywhere.
 */
import type { PeriodRange, PeriodSummary, Transaction, TransactionType } from './types'
import { eachDay, inRange, isWeekend, monthKey } from './dates'

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const isCounted = (t: Transaction) => t.status !== 'void'

export const EXPENSE_LIKE: TransactionType[] = ['expense']
export const CONTRA_EXPENSE: TransactionType[] = ['refund', 'reimbursement']

export function filterPeriod(txs: Transaction[], r: PeriodRange): Transaction[] {
  return txs.filter(t => isCounted(t) && inRange(t.date, r))
}

export function summarize(txs: Transaction[]): PeriodSummary {
  let income = 0, expenses = 0, refunds = 0, savings = 0, investments = 0, transfers = 0, count = 0
  for (const t of txs) {
    if (!isCounted(t)) continue
    const a = Math.abs(Number(t.amount) || 0)
    count++
    switch (t.type) {
      case 'income': income += a; break
      case 'expense': expenses += a; break
      case 'refund':
      case 'reimbursement': refunds += a; break
      case 'savings_contribution': savings += a; break
      case 'savings_withdrawal': savings -= a; break
      case 'investment': investments += a; break
      case 'withdrawal': investments -= a; break
      case 'transfer': transfers += a; break
      case 'adjustment': break
    }
  }
  const netExpenses = expenses - refunds
  const netCashFlow = income - netExpenses
  return {
    income: round2(income),
    expenses: round2(expenses),
    refunds: round2(refunds),
    netExpenses: round2(netExpenses),
    savings: round2(savings),
    investments: round2(investments),
    transfers: round2(transfers),
    netCashFlow: round2(netCashFlow),
    availableCashChange: round2(netCashFlow - savings - investments),
    savingsRate: income > 0 ? round2(((savings + investments) / income) * 100) : 0,
    surplusRate: income > 0 ? round2((netCashFlow / income) * 100) : 0,
    count,
  }
}

export function summarizePeriod(txs: Transaction[], r: PeriodRange): PeriodSummary {
  return summarize(filterPeriod(txs, r))
}

/** Net expense by category (refunds reduce the category they belong to). */
export function expensesByCategory(txs: Transaction[]): { category: string; total: number; count: number }[] {
  const m = new Map<string, { total: number; count: number }>()
  for (const t of txs) {
    if (!isCounted(t)) continue
    const sign = t.type === 'expense' ? 1 : CONTRA_EXPENSE.includes(t.type) ? -1 : 0
    if (!sign) continue
    const e = m.get(t.category) || { total: 0, count: 0 }
    e.total += sign * Math.abs(t.amount)
    if (sign > 0) e.count++
    m.set(t.category, e)
  }
  return [...m.entries()]
    .map(([category, v]) => ({ category, total: round2(v.total), count: v.count }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function incomeByCategory(txs: Transaction[]): { category: string; total: number; count: number }[] {
  const m = new Map<string, { total: number; count: number }>()
  for (const t of txs) {
    if (!isCounted(t) || t.type !== 'income') continue
    const e = m.get(t.category) || { total: 0, count: 0 }
    e.total += Math.abs(t.amount); e.count++
    m.set(t.category, e)
  }
  return [...m.entries()].map(([category, v]) => ({ category, total: round2(v.total), count: v.count })).sort((a, b) => b.total - a.total)
}

export interface DailyRow { date: string; income: number; expenses: number; net: number; savings: number; investments: number; count: number }

export function dailySeries(txs: Transaction[], r: PeriodRange): DailyRow[] {
  const by = new Map<string, Transaction[]>()
  for (const t of filterPeriod(txs, r)) {
    const a = by.get(t.date) || []; a.push(t); by.set(t.date, a)
  }
  return eachDay(r).map(date => {
    const s = summarize(by.get(date) || [])
    return { date, income: s.income, expenses: s.netExpenses, net: s.netCashFlow, savings: s.savings, investments: s.investments, count: s.count }
  })
}

export interface MonthlyRow extends PeriodSummary { month: string }

export function monthlySeries(txs: Transaction[], r: PeriodRange): MonthlyRow[] {
  const by = new Map<string, Transaction[]>()
  for (const t of filterPeriod(txs, r)) {
    const k = monthKey(t.date); const a = by.get(k) || []; a.push(t); by.set(k, a)
  }
  const months: string[] = []
  for (let m = r.start.slice(0, 7); m <= r.end.slice(0, 7);) {
    months.push(m)
    const [y, mo] = m.split('-').map(Number)
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
  }
  return months.map(month => ({ month, ...summarize(by.get(month) || []) }))
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return round2(((current - previous) / Math.abs(previous)) * 100)
}

/** Group transactions by day, newest first (for the daily view / transaction list). */
export function groupByDay(txs: Transaction[]): { date: string; items: Transaction[]; summary: PeriodSummary }[] {
  const by = new Map<string, Transaction[]>()
  for (const t of txs) { const a = by.get(t.date) || []; a.push(t); by.set(t.date, a) }
  return [...by.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => (b.time || '').localeCompare(a.time || '') || (b.createdAt || '').localeCompare(a.createdAt || '')),
      summary: summarize(items),
    }))
}

export function weekdayWeekendSplit(txs: Transaction[]) {
  let wd = 0, we = 0
  const wdDays = new Set<string>(), weDays = new Set<string>()
  for (const t of txs) {
    if (!isCounted(t) || t.type !== 'expense') continue
    if (isWeekend(t.date)) { we += t.amount; weDays.add(t.date) } else { wd += t.amount; wdDays.add(t.date) }
  }
  return { weekday: round2(wd), weekend: round2(we) }
}

/** Signed effect of a transaction on account balances. */
export function balanceEffects(t: Pick<Transaction, 'type' | 'amount' | 'accountId' | 'toAccountId' | 'status'>): { accountId: string; delta: number }[] {
  if (t.status === 'void') return []
  const a = Math.abs(Number(t.amount) || 0)
  const out: { accountId: string; delta: number }[] = []
  const from = t.accountId, to = t.toAccountId
  switch (t.type) {
    case 'income':
    case 'refund':
    case 'reimbursement':
    case 'savings_withdrawal':
    case 'withdrawal':
      if (from) out.push({ accountId: from, delta: a })
      if (to && (t.type === 'savings_withdrawal' || t.type === 'withdrawal')) out.push({ accountId: to, delta: -a })
      break
    case 'expense':
      if (from) out.push({ accountId: from, delta: -a })
      break
    case 'transfer':
    case 'savings_contribution':
    case 'investment':
      if (from) out.push({ accountId: from, delta: -a })
      if (to) out.push({ accountId: to, delta: a })
      break
    case 'adjustment':
      // adjustment amount sign is carried on `amount` (can be negative)
      if (from) out.push({ accountId: from, delta: Number(t.amount) || 0 })
      break
  }
  return out
}
