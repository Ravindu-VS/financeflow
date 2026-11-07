/**
 * Pure mapping from the pre-upgrade Firestore collections to the transaction model.
 * Non-destructive: legacy docs are never modified or deleted. Deterministic ids
 * (`legacy_<collection>_<docId>`) make the migration idempotent and re-runnable.
 */
import type { RecurringRule, Transaction, Frequency } from './types'
import { mapLegacyExpenseCategory, mapLegacyIncomeCategory, mapLegacyInvestmentType, isEssentialCategory } from './categories'
import { legacyToDateKey, todayKey } from './dates'
import { round2 } from './aggregate'

export interface LegacyData {
  incomes: any[]       // each must include `id`
  expenses: any[]
  savingsGoals: any[]
  investments: any[]
}

export interface MigrationPlan {
  transactions: Transaction[]
  rules: RecurringRule[]
  skipped: { collection: string; id: string; reason: string }[]
  totalsBefore: { income: number; expense: number; savings: number; investment: number }
  totalsAfter: { income: number; expense: number; savings: number; investment: number }
  counts: { incomes: number; expenses: number; contributions: number; investments: number; rules: number }
  warnings: string[]
}

const FREQ_MAP: Record<string, Frequency> = {
  daily: 'daily', weekly: 'weekly', biweekly: 'biweekly', 'bi-weekly': 'biweekly', monthly: 'monthly',
  quarterly: 'quarterly', yearly: 'annual', annual: 'annual', annually: 'annual', semiannual: 'semiannual',
}

const num = (v: any) => { const n = Number(v); return isFinite(n) ? n : NaN }

export function planLegacyMigration(data: LegacyData, opts: { defaultAccountId: string; currency?: string; today?: string }): MigrationPlan {
  const currency = opts.currency || 'LKR'
  const today = opts.today || todayKey()
  const transactions: Transaction[] = []
  const rules: RecurringRule[] = []
  const skipped: MigrationPlan['skipped'] = []
  const warnings: string[] = []
  const before = { income: 0, expense: 0, savings: 0, investment: 0 }
  const after = { income: 0, expense: 0, savings: 0, investment: 0 }
  const counts = { incomes: 0, expenses: 0, contributions: 0, investments: 0, rules: 0 }

  const makeRule = (collection: string, d: any, tx: Transaction): string | undefined => {
    const isRec = d.isRecurring === true || d.isRecurring === 'true' || d.isRecurring === 'on'
    if (!isRec) return undefined
    const freq = FREQ_MAP[String(d.recurringFrequency || d.recurringDetails?.frequency || 'monthly').toLowerCase()] || 'monthly'
    const id = `legacy_${collection}_${d.id}`
    rules.push({
      id,
      type: tx.type,
      amount: tx.amount,
      currency,
      category: tx.category,
      description: tx.description || tx.merchant || '',
      merchant: tx.merchant,
      accountId: opts.defaultAccountId,
      frequency: freq,
      startDate: tx.date,
      // Legacy rules are created in reminder mode: we never start auto-posting
      // transactions the user did not explicitly ask for.
      autoGenerate: false,
      reminder: true,
      isBill: tx.type === 'expense' && isEssentialCategory(tx.category),
      isEssential: tx.isEssential,
      lastGeneratedDate: tx.date,
      active: true,
    })
    counts.rules++
    return id
  }

  for (const d of data.incomes || []) {
    const a = num(d.amount); const date = legacyToDateKey(d.date)
    if (isFinite(a)) before.income += a
    if (!isFinite(a) || a <= 0 || !date) { skipped.push({ collection: 'incomes', id: d.id, reason: !date ? 'invalid date' : 'invalid amount' }); continue }
    const tx: Transaction = {
      id: `legacy_incomes_${d.id}`, type: 'income', amount: round2(a), currency, date,
      category: mapLegacyIncomeCategory(d.category || d.source),
      description: d.description || d.source || '',
      merchant: d.metadata?.payer || (d.source && d.source !== d.category ? d.source : undefined),
      accountId: opts.defaultAccountId, tags: Array.isArray(d.tags) ? d.tags : undefined,
      status: 'cleared', source: 'migration', legacy: { collection: 'incomes', id: d.id },
    }
    tx.recurrenceId = makeRule('incomes', d, tx)
    transactions.push(tx); after.income += tx.amount; counts.incomes++
  }

  for (const d of data.expenses || []) {
    const a = num(d.amount); const date = legacyToDateKey(d.date)
    if (isFinite(a)) before.expense += a
    if (!isFinite(a) || a <= 0 || !date) { skipped.push({ collection: 'expenses', id: d.id, reason: !date ? 'invalid date' : 'invalid amount' }); continue }
    const category = mapLegacyExpenseCategory(d.category)
    if (String(d.category || '').toLowerCase() === 'investments') warnings.push(`Expense ${d.id} was categorised "Investments" — kept as an expense; re-classify as an investment if it was one.`)
    const tx: Transaction = {
      id: `legacy_expenses_${d.id}`, type: 'expense', amount: round2(a), currency, date, category,
      subcategory: d.subCategory, description: d.description || '', notes: d.notes || undefined,
      merchant: typeof d.merchant === 'string' ? d.merchant : d.merchant?.name,
      paymentMethod: d.paymentMethod, accountId: opts.defaultAccountId,
      tags: Array.isArray(d.tags) ? d.tags : undefined,
      isEssential: d.isNecessary ?? isEssentialCategory(category),
      status: 'cleared', source: 'migration', legacy: { collection: 'expenses', id: d.id },
    }
    tx.recurrenceId = makeRule('expenses', d, tx)
    transactions.push(tx); after.expense += tx.amount; counts.expenses++
  }

  for (const g of data.savingsGoals || []) {
    const contribs: any[] = Array.isArray(g.contributions) ? g.contributions : []
    let sum = 0
    contribs.forEach((c, i) => {
      if (c.txId) return // recorded by the new transaction flow already
      const a = num(c.amount); const date = legacyToDateKey(c.date) || legacyToDateKey(g.createdAt) || today
      if (isFinite(a)) { before.savings += a; sum += a }
      if (!isFinite(a) || a <= 0) { skipped.push({ collection: 'savingsGoals', id: `${g.id}#${i}`, reason: 'invalid amount' }); return }
      transactions.push({
        id: `legacy_savings_${g.id}_${i}`, type: 'savings_contribution', amount: round2(a), currency, date,
        category: 'savings', description: `Contribution: ${g.name || 'Savings goal'}`, notes: c.notes || c.note || undefined,
        accountId: opts.defaultAccountId, goalId: g.id, status: 'cleared', source: 'migration',
        legacy: { collection: 'savingsGoals', id: `${g.id}#${i}` },
      })
      after.savings += a; counts.contributions++
    })
    const cur = num(g.currentAmount)
    if (isFinite(cur) && cur > sum + 0.01) {
      // Starting balance entered directly on the goal without a contribution record — keep as opening amount, not a transaction.
      warnings.push(`Goal "${g.name}" has ${round2(cur - sum)} not backed by contribution records; it is kept as the goal's opening amount (no transaction created).`)
    }
  }

  for (const inv of data.investments || []) {
    if (inv.txId) continue // created after the upgrade with its own transaction
    const a = num(inv.amount ?? inv.investedAmount); const date = legacyToDateKey(inv.purchaseDate) || legacyToDateKey(inv.date) || legacyToDateKey(inv.createdAt)
    if (isFinite(a)) before.investment += a
    if (!isFinite(a) || a <= 0 || !date) { skipped.push({ collection: 'investments', id: inv.id, reason: !date ? 'invalid date' : 'invalid amount' }); continue }
    transactions.push({
      id: `legacy_investments_${inv.id}`, type: 'investment', amount: round2(a), currency, date,
      category: mapLegacyInvestmentType(inv.type), description: inv.name || 'Investment',
      accountId: opts.defaultAccountId, investmentId: inv.id, status: 'cleared', source: 'migration',
      legacy: { collection: 'investments', id: inv.id },
    })
    after.investment += a; counts.investments++
  }

  const r = (o: typeof before) => ({ income: round2(o.income), expense: round2(o.expense), savings: round2(o.savings), investment: round2(o.investment) })
  return { transactions, rules, skipped, totalsBefore: r(before), totalsAfter: r(after), counts, warnings }
}

/** Migration is valid when every valid legacy amount is accounted for (skipped rows explain any gap). */
export function validateMigrationPlan(p: MigrationPlan): { ok: boolean; diffs: Record<string, number> } {
  const diffs: Record<string, number> = {}
  let ok = true
  for (const k of ['income', 'expense', 'savings', 'investment'] as const) {
    diffs[k] = round2(p.totalsBefore[k] - p.totalsAfter[k])
    if (Math.abs(diffs[k]) > 0.01 && !p.skipped.length) ok = false
  }
  return { ok, diffs }
}
