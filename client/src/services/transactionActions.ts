/**
 * High-level transaction actions with their side effects on goals, holdings and rules.
 * UI components call these instead of touching Firestore directly.
 */
import { transactionService, recurringService, NewTransaction } from './financeService'
import { savingsService, investmentService } from './firebaseService'
import { useFinanceStore } from '../store/financeStore'
import type { RecurringRule, Transaction, Frequency } from '../lib/finance'
import { todayKey, buildOccurrence, occurrencesBetween, occurrenceId, withBaseAmount } from '../lib/finance'
import { Timestamp } from 'firebase/firestore'

export interface SaveOptions {
  repeat?: { frequency: Frequency; interval?: number; customUnit?: RecurringRule['customUnit']; endDate?: string; autoGenerate: boolean; isBill?: boolean; variableAmount?: boolean }
  newHolding?: { name: string; riskLevel?: string }
  existingHoldingId?: string
}

/** Apply the user's base currency & FX rates (freezes baseAmount for foreign-currency entries). */
export function toBaseCurrency<T extends { amount: number; currency: string; fxRate?: number; baseAmount?: number }>(t: T): T {
  const { settings } = useFinanceStore.getState()
  return withBaseAmount(t, settings.baseCurrency || 'LKR', settings.fxRates || {})
}

export async function saveTransaction(t: NewTransaction, opts: SaveOptions = {}) {
  t = toBaseCurrency(t)
  const { accounts, goals, holdings } = useFinanceStore.getState()
  const today = todayKey()
  let recurrenceId: string | undefined

  if (opts.repeat) {
    const rule: Omit<RecurringRule, 'id'> = {
      type: t.type, amount: t.amount, currency: t.currency, category: t.category, subcategory: t.subcategory,
      description: t.description || t.merchant || '', merchant: t.merchant, accountId: t.accountId, toAccountId: t.toAccountId,
      frequency: opts.repeat.frequency, interval: opts.repeat.interval, customUnit: opts.repeat.customUnit,
      startDate: t.date, endDate: opts.repeat.endDate || undefined, autoGenerate: opts.repeat.autoGenerate, reminder: true,
      isBill: opts.repeat.isBill, isEssential: t.isEssential, variableAmount: opts.repeat.variableAmount,
      // The first occurrence is the transaction being saved now (if it is not in the future).
      lastGeneratedDate: t.date <= today ? t.date : undefined,
      active: true,
    }
    recurrenceId = await recurringService.save(rule)
    if (t.date > today) return { id: recurrenceId, queued: false, ruleOnly: true }
    const occ = buildOccurrence({ ...rule, id: recurrenceId } as RecurringRule, t.date)
    t = { ...t, id: occ.id, recurrenceId }
  }

  // Investment: create or top up a holding so the portfolio stays in sync
  if (t.type === 'investment') {
    if (opts.existingHoldingId) {
      const h = holdings.find(x => x.id === opts.existingHoldingId)
      if (h) {
        const b = t.baseAmount ?? t.amount
        await investmentService.update(h.id, { amount: (Number(h.amount) || 0) + b, currentValue: (Number(h.currentValue) || Number(h.amount) || 0) + b })
        t = { ...t, investmentId: h.id }
      }
    } else if (opts.newHolding) {
      const id = (t as any).id || undefined
      const created: any = await investmentService.create({
        name: opts.newHolding.name || t.description || 'Investment', type: t.category, amount: t.baseAmount ?? t.amount, currentValue: t.baseAmount ?? t.amount,
        purchaseDate: Timestamp.fromDate(new Date(t.date + 'T12:00:00')), riskLevel: opts.newHolding.riskLevel || 'medium', status: 'active', txId: id || 'pending',
      })
      t = { ...t, investmentId: created.id }
    }
  }

  const res = await transactionService.create(t, { accounts })

  if (t.type === 'investment' && t.investmentId) investmentService.update(t.investmentId, { txId: res.id }).catch(() => {})
  if ((t.type === 'savings_contribution' || t.type === 'savings_withdrawal') && t.goalId) {
    const g: any = goals.find(x => x.id === t.goalId) || await savingsService.getById(t.goalId)
    if (g) {
      const baseAmt = t.baseAmount ?? t.amount
      const delta = t.type === 'savings_contribution' ? baseAmt : -baseAmt
      const cur = (Number(g.currentAmount) || 0) + delta
      await savingsService.update(g.id, {
        currentAmount: cur,
        status: cur >= (Number(g.targetAmount) || Infinity) ? 'completed' : 'active',
        contributions: [...(g.contributions || []), { amount: delta, date: Timestamp.fromDate(new Date(t.date + 'T12:00:00')), notes: t.notes || '', txId: res.id }],
      })
    }
  }
  useFinanceStore.getState().refreshModules()
  return res
}

export async function updateTransaction(before: Transaction, patch: Partial<Transaction>) {
  const { accounts, goals } = useFinanceStore.getState()
  if (patch.amount !== undefined || patch.currency !== undefined) {
    patch = toBaseCurrency({ ...patch, amount: patch.amount ?? before.originalAmount ?? before.amount, currency: patch.currency ?? before.currency } as any)
  }
  const r = await transactionService.update(before, patch, { accounts })
  // keep goal totals consistent when a contribution's amount changes
  if (before.goalId && patch.amount !== undefined && patch.amount !== before.amount) {
    const g = goals.find(x => x.id === before.goalId)
    const sign = before.type === 'savings_contribution' ? 1 : -1
    if (g) await savingsService.update(g.id, { currentAmount: (Number(g.currentAmount) || 0) + sign * ((patch.baseAmount ?? patch.amount) - before.amount) })
  }
  return r
}

export async function deleteTransaction(t: Transaction) {
  const { accounts, goals } = useFinanceStore.getState()
  const r = await transactionService.remove(t, { accounts })
  if (t.goalId) {
    const g = goals.find(x => x.id === t.goalId)
    const sign = t.type === 'savings_contribution' ? -1 : 1
    if (g) await savingsService.update(g.id, {
      currentAmount: Math.max(0, (Number(g.currentAmount) || 0) + sign * t.amount),
      contributions: (g.contributions || []).filter((c: any) => c.txId !== t.id),
    })
    useFinanceStore.getState().refreshModules()
  }
  return r
}

/** Accept a detected recurring pattern → create a rule (reminder mode) and link the matched transactions. */
export async function acceptRecurringSuggestion(s: { merchant: string; category: string; type: Transaction['type']; averageAmount: number; frequency: Frequency; lastDate: string; transactionIds: string[]; isSubscription: boolean }) {
  const { transactions, accounts } = useFinanceStore.getState()
  const linked = transactions.filter(t => s.transactionIds.includes(t.id))
  const first = linked.sort((a, b) => a.date.localeCompare(b.date))[0]
  const id = await recurringService.save({
    type: s.type, amount: s.averageAmount, currency: 'LKR', category: s.isSubscription ? 'subscriptions' : s.category,
    description: s.merchant, merchant: s.merchant, accountId: first?.accountId || accounts[0]?.id,
    frequency: s.frequency, startDate: first?.date || s.lastDate, autoGenerate: false, reminder: true,
    isBill: s.type === 'expense', lastGeneratedDate: s.lastDate, active: true,
  })
  for (const t of linked) await transactionService.update(t, { recurrenceId: id }, { accounts })
  return id
}

/** Preview helper for the rule form. */
export function nextDates(rule: Pick<RecurringRule, 'frequency' | 'interval' | 'customUnit' | 'startDate' | 'endDate' | 'skippedDates'>, n = 3, from = todayKey()) {
  return occurrencesBetween({ ...rule, id: 'x', type: 'expense', amount: 0, currency: 'LKR', category: '', description: '', autoGenerate: false, active: true } as RecurringRule, from, '2100-01-01', n)
}

/** Record a reminder-only bill occurrence as paid (idempotent: deterministic id). */
export async function payBill(rule: RecurringRule, date: string) {
  const { accounts, transactions } = useFinanceStore.getState()
  const t = buildOccurrence(rule, date)
  if (transactions.some(x => x.id === occurrenceId(rule.id, date))) return // already paid
  await transactionService.create({ ...t, id: occurrenceId(rule.id, date), source: 'manual' }, { accounts })
  if (!rule.lastGeneratedDate || date > rule.lastGeneratedDate) await recurringService.save({ ...rule, lastGeneratedDate: date })
}

