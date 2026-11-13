import { describe, it, expect } from 'vitest'
import {
  summarize, summarizePeriod, expensesByCategory, dailySeries, groupByDay, balanceEffects,
  makePeriod, shiftPeriod, addMonths, legacyToDateKey, isValidDateKey, startOfWeek,
  occurrencesBetween, pendingOccurrences, buildOccurrence, occurrenceId, monthlyEquivalent,
  computeBalances, balancesAsOf, cashFlowStatement, netWorth, availableCash, safeToSpend, nonMonthlyProvisions,
  forecastMonthExpenses, forecastCategory, goalRequiredMonthly,
  detectRecurring, findDuplicates, partitionDuplicates, validateTransaction, dataQuality, subscriptionSpend,
  parseFinancialText, planLegacyMigration, withBaseAmount, normalizeToBase, toBase, invertRates, makeCustomCategory, registerCustomCategories, categoriesForType, getCategory, validateMigrationPlan, analyzeBehavior, generateInsights,
  toCSV, previewCSVImport, parseCSV,
} from '..'
import type { Account, RecurringRule, Transaction } from '..'

let seq = 0
const tx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>): Transaction => ({
  id: `t${++seq}`, currency: 'LKR', category: p.type === 'income' ? 'salary' : 'other', status: 'cleared', source: 'manual', accountId: 'bank', ...p,
})
const rule = (p: Partial<RecurringRule>): RecurringRule => ({
  id: 'r1', type: 'expense', amount: 1000, currency: 'LKR', category: 'housing', description: 'Rent', frequency: 'monthly',
  startDate: '2026-01-01', autoGenerate: true, active: true, ...p,
})

const accounts: Account[] = [
  { id: 'cash', name: 'Cash', type: 'cash', currency: 'LKR', openingBalance: 5000 },
  { id: 'bank', name: 'Bank', type: 'bank', currency: 'LKR', openingBalance: 50000 },
  { id: 'sav', name: 'Savings', type: 'savings', currency: 'LKR', openingBalance: 0 },
  { id: 'cc', name: 'Card', type: 'credit_card', currency: 'LKR', openingBalance: 0 },
]

// ─────────────── §57 Financial calculation scenario ───────────────
describe('§57 accounting scenario', () => {
  const nov: Transaction[] = [
    tx({ type: 'income', amount: 100000, date: '2026-11-01' }),
    tx({ type: 'expense', amount: 40000, date: '2026-11-05', category: 'food_dining' }),
    tx({ type: 'savings_contribution', amount: 20000, date: '2026-11-06', toAccountId: 'sav', category: 'savings' }),
    tx({ type: 'investment', amount: 10000, date: '2026-11-07', category: 'fixed_deposit' }),
    tx({ type: 'transfer', amount: 30000, date: '2026-11-08', accountId: 'bank', toAccountId: 'cash', category: 'transfer' }),
  ]
  const s = summarize(nov)
  it('income = 100,000', () => expect(s.income).toBe(100000))
  it('expenses = 40,000 (transfer does not increase expense)', () => { expect(s.expenses).toBe(40000); expect(s.netExpenses).toBe(40000) })
  it('transfer is tracked separately and never counted as income/expense', () => expect(s.transfers).toBe(30000))
  it('savings and investments are not expenses', () => { expect(s.savings).toBe(20000); expect(s.investments).toBe(10000) })
  it('net cash flow and available-cash change', () => { expect(s.netCashFlow).toBe(60000); expect(s.availableCashChange).toBe(30000) })
  it('savings rate = (savings+investments)/income', () => expect(s.savingsRate).toBe(30))
  it('available cash computed from spendable balances', () => {
    const b = computeBalances(accounts, nov)
    // bank: 50000 +100000 -40000 -20000 -10000 -30000 = 50000 ; cash: 5000 + 30000 ; savings 20000
    expect(b.bank).toBe(50000); expect(b.cash).toBe(35000); expect(b.sav).toBe(20000)
    expect(availableCash(accounts, b)).toBe(85000) // = 55000 opening + 30000 availableCashChange
  })
  it('transfer leaves total assets unchanged', () => {
    const only = [tx({ type: 'transfer', amount: 30000, date: '2026-11-08', accountId: 'bank', toAccountId: 'cash' })]
    const b = computeBalances(accounts, only)
    expect(netWorth(accounts, b).netWorth).toBe(55000)
  })
})

describe('transaction types', () => {
  it('one-time expense needs no recurrence', () => {
    const t = tx({ type: 'expense', amount: 450, date: '2026-11-07', category: 'food_dining', description: 'Lunch' })
    expect(validateTransaction(t, { today: '2026-11-07' }).filter(i => i.severity === 'error')).toHaveLength(0)
    expect(summarize([t]).expenses).toBe(450)
  })
  it('one-time irregular income', () => expect(summarize([tx({ type: 'income', amount: 12000, date: '2026-11-07', category: 'freelance' })]).income).toBe(12000))
  it('unexpected expense counted and surfaced', () => {
    const all = [tx({ type: 'expense', amount: 7500, date: '2026-11-07', kind: 'unexpected', description: 'Vehicle repair', category: 'transport' })]
    const b = analyzeBehavior(all, { start: '2026-11-01', end: '2026-11-30' })
    expect(b.unexpected.total).toBe(7500); expect(b.unexpected.largest?.description).toBe('Vehicle repair')
  })
  it('refund reduces net expenses and its category, not income', () => {
    const all = [tx({ type: 'expense', amount: 5000, date: '2026-11-02', category: 'shopping' }), tx({ type: 'refund', amount: 2000, date: '2026-11-03', category: 'shopping' })]
    const s = summarize(all)
    expect(s.income).toBe(0); expect(s.netExpenses).toBe(3000)
    expect(expensesByCategory(all)).toEqual([{ category: 'shopping', total: 3000, count: 1 }])
  })
  it('void transactions are ignored', () => expect(summarize([tx({ type: 'expense', amount: 999, date: '2026-11-01', status: 'void' })]).expenses).toBe(0))
  it('savings withdrawal reverses savings; investment withdrawal reverses investments', () => {
    const s = summarize([
      tx({ type: 'savings_contribution', amount: 5000, date: '2026-11-01' }), tx({ type: 'savings_withdrawal', amount: 2000, date: '2026-11-02' }),
      tx({ type: 'investment', amount: 8000, date: '2026-11-01' }), tx({ type: 'withdrawal', amount: 3000, date: '2026-11-02' }),
    ])
    expect(s.savings).toBe(3000); expect(s.investments).toBe(5000)
  })
  it('balance effects: credit card expense makes liability more negative', () => {
    expect(balanceEffects(tx({ type: 'expense', amount: 1000, date: '2026-11-01', accountId: 'cc' }))).toEqual([{ accountId: 'cc', delta: -1000 }])
    const b = computeBalances(accounts, [tx({ type: 'expense', amount: 1000, date: '2026-11-01', accountId: 'cc' })])
    expect(netWorth(accounts, b).liabilities).toBe(1000)
  })
})

describe('periods & dates', () => {
  it('current month is the default this_month period', () => {
    const p = makePeriod('this_month', '2026-11-07')
    expect(p).toMatchObject({ start: '2026-11-01', end: '2026-11-30', label: 'November 2026' })
  })
  it('previous month navigation', () => {
    const p = shiftPeriod(makePeriod('this_month', '2026-11-07'), -1)
    expect(p).toMatchObject({ start: '2026-10-01', end: '2026-10-31', label: 'October 2026' })
    expect(shiftPeriod(makePeriod('this_month', '2026-01-15'), -1)).toMatchObject({ start: '2025-12-01', end: '2025-12-31' })
    expect(shiftPeriod(makePeriod('this_month', '2026-03-10'), -1)).toMatchObject({ start: '2026-02-01', end: '2026-02-28' })
  })
  it('last month / this week / year / custom', () => {
    expect(makePeriod('last_month', '2026-11-07')).toMatchObject({ start: '2026-10-01', end: '2026-10-31' })
    expect(makePeriod('this_week', '2026-11-07')).toMatchObject({ start: '2026-11-02', end: '2026-11-08' }) // Mon–Sun
    expect(makePeriod('last_3_months', '2026-11-07')).toMatchObject({ start: '2026-09-01', end: '2026-11-30' })
    expect(makePeriod('custom', '2026-11-07', { start: '2026-11-10', end: '2026-11-03' })).toMatchObject({ start: '2026-11-03', end: '2026-11-10' })
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02')
  })
  it('custom range filters correctly incl. boundaries', () => {
    const all = [tx({ type: 'expense', amount: 1, date: '2026-10-31' }), tx({ type: 'expense', amount: 2, date: '2026-11-01' }), tx({ type: 'expense', amount: 4, date: '2026-11-30' }), tx({ type: 'expense', amount: 8, date: '2026-12-01' })]
    expect(summarizePeriod(all, { start: '2026-11-01', end: '2026-11-30' }).expenses).toBe(6)
  })
  it('month clamping', () => { expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'); expect(addMonths('2024-01-31', 1)).toBe('2024-02-29') })
  it('legacy UTC-midnight timestamps keep their calendar day', () => {
    expect(legacyToDateKey(new Date(Date.UTC(2026, 10, 7)))).toBe('2026-11-07')
    expect(legacyToDateKey({ seconds: Date.UTC(2026, 10, 7) / 1000 })).toBe('2026-11-07')
    expect(legacyToDateKey({ toDate: () => new Date(Date.UTC(2026, 0, 1)) })).toBe('2026-01-01')
    expect(legacyToDateKey('2026-02-30')).toBeNull()
    expect(isValidDateKey('2026-02-29')).toBe(false)
  })
  it('daily view sums per day', () => {
    const d = dailySeries([tx({ type: 'income', amount: 2500, date: '2026-11-07' }), tx({ type: 'expense', amount: 1350, date: '2026-11-07' })], { start: '2026-11-07', end: '2026-11-07' })
    expect(d[0]).toMatchObject({ income: 2500, expenses: 1350, net: 1150 })
    expect(groupByDay([tx({ type: 'expense', amount: 1, date: '2026-11-01' }), tx({ type: 'expense', amount: 1, date: '2026-11-03' })])[0].date).toBe('2026-11-03')
  })
})

describe('recurring rules', () => {
  it('monthly occurrences keep anchor day and clamp', () => {
    expect(occurrencesBetween(rule({ startDate: '2026-01-31' }), '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })
  it('weekly, biweekly, quarterly, annual, custom', () => {
    expect(occurrencesBetween(rule({ frequency: 'weekly', startDate: '2026-11-02' }), '2026-11-01', '2026-11-30')).toHaveLength(5)
    expect(occurrencesBetween(rule({ frequency: 'biweekly', startDate: '2026-11-02' }), '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-16', '2026-11-30'])
    expect(occurrencesBetween(rule({ frequency: 'quarterly', startDate: '2026-01-15' }), '2026-01-01', '2026-12-31')).toHaveLength(4)
    expect(occurrencesBetween(rule({ frequency: 'annual', startDate: '2025-03-01' }), '2025-01-01', '2027-12-31')).toHaveLength(3)
    expect(occurrencesBetween(rule({ frequency: 'custom', interval: 10, customUnit: 'day', startDate: '2026-11-01' }), '2026-11-01', '2026-11-30')).toEqual(['2026-11-01', '2026-11-11', '2026-11-21'])
  })
  it('respects end date and skipped occurrences', () => {
    const r = rule({ startDate: '2026-01-01', endDate: '2026-03-15', skippedDates: ['2026-02-01'] })
    expect(occurrencesBetween(r, '2026-01-01', '2026-12-31')).toEqual(['2026-01-01', '2026-03-01'])
  })
  it('generation is incremental and idempotent', () => {
    const r = rule({ startDate: '2026-09-01', lastGeneratedDate: '2026-09-01' })
    expect(pendingOccurrences(r, '2026-11-07')).toEqual(['2026-10-01', '2026-11-01'])
    expect(pendingOccurrences({ ...r, lastGeneratedDate: '2026-11-01' }, '2026-11-07')).toEqual([])
    expect(pendingOccurrences({ ...r, autoGenerate: false }, '2026-11-07')).toEqual([])
    expect(occurrenceId('r1', '2026-11-01')).toBe('rec_r1_20261101')
  })
  it('generated transaction is independent of the rule (editing rule does not rewrite history)', () => {
    const r = rule({ amount: 100000, type: 'income', category: 'salary', description: 'Salary' })
    const t = buildOccurrence(r, '2026-11-01')
    r.amount = 120000
    expect(t.amount).toBe(100000); expect(t.recurrenceId).toBe('r1'); expect(t.source).toBe('recurring')
  })
  it('recurring income and expense counted per occurrence', () => {
    const sal = rule({ id: 's', type: 'income', amount: 100000, category: 'salary', startDate: '2026-09-01' })
    const occ = occurrencesBetween(sal, '2026-09-01', '2026-11-30').map(d => buildOccurrence(sal, d))
    expect(summarize(occ).income).toBe(300000)
  })
  it('monthly equivalent', () => {
    expect(monthlyEquivalent(rule({ amount: 60000, frequency: 'annual' }))).toBe(5000)
    expect(monthlyEquivalent(rule({ amount: 30000, frequency: 'semiannual' }))).toBe(5000)
  })
})

describe('planning', () => {
  it('non-monthly provisions: annual insurance 60,000 → 5,000/month', () => {
    const p = nonMonthlyProvisions([rule({ amount: 60000, frequency: 'annual', startDate: '2026-03-01', description: 'Insurance' }), rule({ id: 'x', amount: 1000 })], '2026-11-07')
    expect(p).toHaveLength(1); expect(p[0].monthlyProvision).toBe(5000); expect(p[0].nextDue).toBe('2027-03-01')
  })
  it('safe to spend subtracts bills, commitments and reserve; never negative', () => {
    const r = safeToSpend({
      availableCash: 80000, today: '2026-11-07', savingsCommitment: 10000, investmentCommitment: 5000, emergencyReserve: 20000,
      rules: [rule({ amount: 25000, startDate: '2026-01-20', isBill: true, lastGeneratedDate: '2026-10-20' }), rule({ id: 'n', amount: 999, startDate: '2026-01-25', isBill: false })],
    })
    expect(r.upcomingBills).toBe(25000)
    expect(r.safeToSpend).toBe(20000)
    expect(r.daysLeft).toBe(24); expect(r.dailyLimit).toBe(833.33)
    expect(r.isEstimate).toBe(true)
    expect(safeToSpend({ availableCash: 100, today: '2026-11-07', savingsCommitment: 500, investmentCommitment: 0, emergencyReserve: 0, rules: [] }).safeToSpend).toBe(0)
  })
  it('cash flow statement balances: opening + flows = closing', () => {
    const all = [
      tx({ type: 'income', amount: 1000, date: '2026-10-15' }),
      tx({ type: 'income', amount: 100000, date: '2026-11-01' }),
      tx({ type: 'expense', amount: 40000, date: '2026-11-03' }),
      tx({ type: 'investment', amount: 10000, date: '2026-11-04' }),
      tx({ type: 'savings_contribution', amount: 20000, date: '2026-11-04', toAccountId: 'sav' }),
      tx({ type: 'transfer', amount: 5000, date: '2026-11-05', accountId: 'bank', toAccountId: 'cash' }),
    ]
    const c = cashFlowStatement(accounts, all, { start: '2026-11-01', end: '2026-11-30' })
    expect(c.openingBalance).toBe(56000)
    expect(c.openingBalance + c.income - c.expenses + c.refunds - c.savings - c.investments + c.transfersIn - c.transfersOut + c.adjustments).toBe(c.closingBalance)
    expect(c.closingBalance).toBe(86000)
    // derived from cached current balances gives the same statement
    const current = computeBalances(accounts, all)
    expect(cashFlowStatement(accounts, all.filter(t => t.date >= '2026-11-01'), { start: '2026-11-01', end: '2026-11-30' }, current)).toEqual(c)
    expect(balancesAsOf(current, all, '2026-10-31').bank).toBe(51000)
  })
  it('forecasts are ranges with a confidence label', () => {
    const hist: Transaction[] = []
    for (const m of ['05', '06', '07', '08', '09', '10']) for (let d = 1; d <= 28; d += 3) hist.push(tx({ type: 'expense', amount: 500, date: `2026-${m}-${String(d).padStart(2, '0')}` }))
    hist.push(tx({ type: 'expense', amount: 3000, date: '2026-11-03' }))
    const f = forecastMonthExpenses(hist, [], '2026-11-07')
    expect(f.low).toBeLessThanOrEqual(f.expected); expect(f.high).toBeGreaterThanOrEqual(f.expected)
    expect(f.expected).toBeGreaterThan(3000)
    expect(['low', 'medium', 'high']).toContain(f.confidence)
    // one-off / unexpected spending is not extrapolated
    const withRepair = [...hist, tx({ type: 'expense', amount: 30000, date: '2026-11-04', kind: 'unexpected' })]
    const f2 = forecastMonthExpenses(withRepair, [], '2026-11-07')
    expect(f2.expected - f.expected).toBeCloseTo(30000, 0)
  })
  it('category forecast & goal contribution', () => {
    expect(forecastCategory(11500, '2026-11-15')).toBe(23000)
    // a one-off Rs. 7,500 repair is counted once, not extrapolated over the month
    expect(forecastCategory(7500, '2026-11-07', undefined, 7500)).toBe(7500)
    expect(forecastCategory(8500, '2026-11-10', undefined, 7500)).toBe(10500)
    expect(goalRequiredMonthly(100000, 40000, '2027-05-07', '2026-11-07')).toMatchObject({ remaining: 60000, months: 6, perMonth: 10000 })
  })
})

describe('detection & data quality', () => {
  const subs = ['2026-07-03', '2026-08-03', '2026-09-03', '2026-10-03'].map(d => tx({ type: 'expense', amount: 2500, date: d, merchant: 'Netflix', category: 'entertainment' }))
  it('detects recurring subscription-like payments, but only suggests', () => {
    const s = detectRecurring(subs)
    expect(s).toHaveLength(1); expect(s[0]).toMatchObject({ frequency: 'monthly', isSubscription: true, averageAmount: 2500, occurrences: 4 })
    expect(detectRecurring(subs, [rule({ merchant: 'Netflix' })])).toHaveLength(0)
    expect(detectRecurring(subs, [], ['expense:netflix'])).toHaveLength(0)
  })
  it('irregular payments are not flagged recurring', () => {
    const irr = ['2026-07-03', '2026-07-09', '2026-09-20', '2026-10-01'].map(d => tx({ type: 'expense', amount: 2500, date: d, merchant: 'Shop' }))
    expect(detectRecurring(irr)).toHaveLength(0)
  })
  it('subscription spend for a month', () => expect(subscriptionSpend(subs, '2026-10-01', '2026-10-31').total).toBe(2500))
  it('duplicate detection', () => {
    const a = tx({ type: 'expense', amount: 850, date: '2026-11-07', merchant: 'Cafe' })
    expect(findDuplicates({ type: 'expense', amount: 850, date: '2026-11-08', merchant: 'cafe' }, [a])).toHaveLength(1)
    expect(findDuplicates({ type: 'expense', amount: 851, date: '2026-11-07', merchant: 'Cafe' }, [a])).toHaveLength(0)
    const p = partitionDuplicates([{ ...a, id: undefined as any }, { ...a, id: undefined as any }], [])
    expect(p.fresh).toHaveLength(1); expect(p.dupes).toHaveLength(1)
  })
  it('validation catches bad amounts, dates and transfers', () => {
    const errs = (t: Partial<Transaction>) => validateTransaction(t, { today: '2026-11-07' }).filter(i => i.severity === 'error').map(i => i.field)
    expect(errs({ type: 'expense', amount: 0, date: '2026-11-07', category: 'x' })).toContain('amount')
    expect(errs({ type: 'expense', amount: 10, date: '2026-13-01', category: 'x' })).toContain('date')
    expect(errs({ type: 'expense', amount: 10, date: '2028-01-01', category: 'x' })).toContain('date')
    expect(errs({ type: 'transfer', amount: 10, date: '2026-11-07', accountId: 'a', toAccountId: 'a' })).toContain('toAccountId')
    expect(validateTransaction({ type: 'expense', amount: 10, date: '2026-11-07' }).some(i => i.field === 'category')).toBe(true)
  })
  it('data quality report finds duplicates and missing categories', () => {
    const a = tx({ type: 'expense', amount: 100, date: '2026-11-01', merchant: 'X' })
    const q = dataQuality([a, { ...a, id: 'dup' }, tx({ type: 'expense', amount: 5, date: '2026-11-01', category: '' })], '2026-11-07')
    expect(q.duplicateGroups).toHaveLength(1); expect(q.missingCategory).toHaveLength(1)
  })
})

describe('voice parser', () => {
  const T = '2026-11-07'
  it.each([
    ['Spent Rs. 450 on lunch today', 'expense', 450, 'food_dining'],
    ['Paid 3,500 for vehicle repair today', 'expense', 3500, 'transport'],
    ['Received 15,000 from freelance work', 'income', 15000, 'freelance'],
    ['Received Rs. 5,000 from a friend', 'income', 5000, 'gift'],
    ['Invested 20,000 in a fixed deposit', 'investment', 20000, 'fixed_deposit'],
    ['Saved 5000 to emergency fund', 'savings_contribution', 5000, 'savings'],
    ['Transfer 20000 from bank to savings', 'transfer', 20000, 'transfer'],
    ['Got a refund of 1200 for shoes', 'refund', 1200, 'shopping'],
    ['salary 1.5 lakhs', 'income', 150000, 'salary'],
  ])('%s', (text, type, amount, category) => {
    const p = parseFinancialText(text, T)
    expect(p).toMatchObject({ type, amount, category })
    expect(p.confidence).toBeGreaterThan(0.5)
  })
  it('dates: yesterday / N days ago', () => {
    expect(parseFinancialText('spent 200 on coffee yesterday', T).date).toBe('2026-11-06')
    expect(parseFinancialText('spent 200 on bus 3 days ago', T).date).toBe('2026-11-04')
  })
  it('flags unexpected', () => expect(parseFinancialText('sudden expense 7500 vehicle repair', T).isUnexpected).toBe(true))
  it('unknown text has low confidence', () => expect(parseFinancialText('hello there', T).confidence).toBeLessThan(0.5))
})

describe('legacy migration', () => {
  const legacy = {
    incomes: [
      { id: 'i1', amount: 100000, category: 'salary', source: 'Company', date: new Date(Date.UTC(2026, 9, 1)), isRecurring: true, recurringFrequency: 'monthly' },
      { id: 'i2', amount: 15000, category: 'freelance', source: 'Upwork', date: { seconds: Date.UTC(2026, 9, 12) / 1000 }, isRecurring: false, recurringFrequency: 'monthly' },
      { id: 'bad', amount: 'x', date: new Date() },
    ],
    expenses: [
      { id: 'e1', amount: 850, category: 'Food & Dining', description: 'Lunch', date: new Date(Date.UTC(2026, 9, 3)), isRecurring: false },
      { id: 'e2', amount: 25000, category: 'Housing', description: 'Rent', date: new Date(Date.UTC(2026, 9, 5)), isRecurring: true, recurringFrequency: 'monthly' },
    ],
    savingsGoals: [{ id: 'g1', name: 'Emergency', currentAmount: 7000, contributions: [{ amount: 5000, date: new Date(Date.UTC(2026, 9, 20)) }] }],
    investments: [{ id: 'v1', name: 'FD', type: 'fixed_deposit', amount: 20000, purchaseDate: '2026-10-25' }],
  }
  const plan = planLegacyMigration(legacy, { defaultAccountId: 'main', today: '2026-11-07' })
  it('maps every valid legacy record to one transaction', () => {
    expect(plan.counts).toEqual({ incomes: 2, expenses: 2, contributions: 1, investments: 1, rules: 2 })
    expect(plan.transactions.map(t => t.id)).toContain('legacy_incomes_i1')
    expect(plan.skipped).toEqual([{ collection: 'incomes', id: 'bad', reason: 'invalid amount' }])
  })
  it('one-time items no longer carry a recurrence', () => {
    expect(plan.transactions.find(t => t.id === 'legacy_incomes_i2')!.recurrenceId).toBeUndefined()
    expect(plan.transactions.find(t => t.id === 'legacy_incomes_i1')!.recurrenceId).toBe('legacy_incomes_i1')
  })
  it('legacy recurring become reminder-only rules (never auto-post)', () => {
    expect(plan.rules.every(r => r.autoGenerate === false && r.lastGeneratedDate === r.startDate)).toBe(true)
  })
  it('categories are normalised and dates preserved', () => {
    const e1 = plan.transactions.find(t => t.id === 'legacy_expenses_e1')!
    expect(e1).toMatchObject({ category: 'food_dining', date: '2026-10-03', source: 'migration' })
  })
  it('totals before == after (excluding skipped)', () => {
    expect(plan.totalsAfter).toEqual({ income: 115000, expense: 25850, savings: 5000, investment: 20000 })
    expect(validateMigrationPlan(plan).ok).toBe(true)
    expect(plan.warnings.some(w => w.includes('Emergency'))).toBe(true)
  })
  it('is deterministic / idempotent', () => {
    const again = planLegacyMigration(legacy, { defaultAccountId: 'main', today: '2026-11-07' })
    expect(again.transactions.map(t => t.id)).toEqual(plan.transactions.map(t => t.id))
  })
})

describe('insights use real data and are labelled', () => {
  it('generates FACT comparisons and PREDICTION for current month', () => {
    const all = [
      tx({ type: 'income', amount: 100000, date: '2026-10-01' }), tx({ type: 'income', amount: 112000, date: '2026-11-01' }),
      tx({ type: 'expense', amount: 10000, date: '2026-10-05', category: 'food_dining' }), tx({ type: 'expense', amount: 14200, date: '2026-11-05', category: 'food_dining' }),
      tx({ type: 'expense', amount: 99999, date: '2026-10-20', category: 'food_dining' }), // after "same point" → excluded from comparison
    ]
    const ins = generateInsights({ all, current: makePeriod('this_month', '2026-11-07'), previous: makePeriod('last_month', '2026-11-07'), today: '2026-11-07' })
    const inc = ins.find(i => i.id === 'income-change')!
    expect(inc.kind).toBe('fact'); expect(inc.value).toBe(12)
    expect(ins.find(i => i.id === 'category-mover')!.detail).toContain('4,200')
    expect(ins.some(i => i.kind === 'prediction')).toBe(true)
    expect(ins.every(i => i.basis.length > 0)).toBe(true)
  })
  it('in-progress periods compare like-for-like (same elapsed days)', () => {
    const all = [tx({ type: 'expense', amount: 1000, date: '2026-10-03' }), tx({ type: 'expense', amount: 50000, date: '2026-10-25' }), tx({ type: 'expense', amount: 1500, date: '2026-11-03' })]
    const ins = generateInsights({ all, current: makePeriod('this_month', '2026-11-07'), previous: makePeriod('last_month', '2026-11-07'), today: '2026-11-07' })
    expect(ins.find(i => i.id === 'expense-change')!.value).toBe(50) // 1500 vs 1000, not vs 51000
  })
  it('weekend vs weekday', () => {
    const all = [tx({ type: 'expense', amount: 1000, date: '2026-11-02' }), tx({ type: 'expense', amount: 3000, date: '2026-11-07' })]
    const b = analyzeBehavior(all, { start: '2026-11-02', end: '2026-11-08' })
    expect(b.weekdayAvgPerDay).toBe(200); expect(b.weekendAvgPerDay).toBe(1500)
  })
})

describe('import / export', () => {
  it('CSV round trip with duplicate detection', () => {
    const existing = [tx({ type: 'expense', amount: 850, date: '2026-11-07', category: 'food_dining', description: 'Lunch, "special"' })]
    const csv = toCSV(existing)
    expect(parseCSV(csv)[1][8]).toBe('Lunch, "special"')
    const p = previewCSVImport(csv, existing, { accountId: 'bank', today: '2026-11-07' })
    expect(p.duplicates).toHaveLength(1); expect(p.valid).toHaveLength(0)
  })
  it('bank-statement style debit/credit with DD/MM/YYYY and invalid rows', () => {
    const csv = 'Date,Description,Debit,Credit\n07/11/2026,Keells,2500,\n06/11/2026,Salary,,100000\n31/02/2026,Bad,10,\n'
    const p = previewCSVImport(csv, [], { today: '2026-11-07' })
    expect(p.valid.map(v => [v.type, v.amount, v.date])).toEqual([['expense', 2500, '2026-11-07'], ['income', 100000, '2026-11-06']])
    expect(p.invalid).toHaveLength(1)
  })
  it('neutralises formula injection in CSV export', () => {
    expect(toCSV([tx({ type: 'expense', amount: 1, date: '2026-11-01', description: '=HYPERLINK("x")' })])).toContain(`"'=HYPERLINK(""x"")"`)
  })
})

describe('custom categories (Other → type your own)', () => {
  it('creates prefixed ids per kind, reuses existing labels and avoids clashes', () => {
    const pet = makeCustomCategory('  Pet   care ', 'expense', [])
    expect(pet).toMatchObject({ id: 'cus_pet_care', label: 'Pet care' })
    expect(makeCustomCategory('pet care', 'expense', [pet]).id).toBe('cus_pet_care') // reused, case-insensitive
    expect(makeCustomCategory('Groceries', 'expense', []).id).toBe('groceries')       // maps to the default
    expect(makeCustomCategory('Tuition classes', 'income', []).id).toBe('inc_tuition_classes')
    expect(makeCustomCategory('Land', 'investment', []).id).toBe('inv_land')
  })
  it('registered categories appear only for their type and resolve labels', () => {
    registerCustomCategories([{ id: 'cus_pet_care', label: 'Pet care', icon: '🏷️', color: '#000' }, { id: 'inc_tuition', label: 'Tuition', icon: '🏷️', color: '#000' }])
    expect(categoriesForType('expense').some(c => c.id === 'cus_pet_care')).toBe(true)
    expect(categoriesForType('income').some(c => c.id === 'cus_pet_care')).toBe(false)
    expect(categoriesForType('income').some(c => c.id === 'inc_tuition')).toBe(true)
    expect(getCategory('cus_pet_care').label).toBe('Pet care')
    registerCustomCategories([])
  })
})

describe('multi-currency', () => {
  const rates = { USD: 300, EUR: 325 }
  it('freezes fxRate and baseAmount for foreign entries; base entries untouched', () => {
    expect(withBaseAmount({ amount: 50, currency: 'USD' }, 'LKR', rates)).toMatchObject({ fxRate: 300, baseAmount: 15000 })
    expect((withBaseAmount({ amount: 50, currency: 'USD', fxRate: 305 } as any, 'LKR', rates) as any).baseAmount).toBe(15250) // manual rate wins
    const b: any = withBaseAmount({ amount: 850, currency: 'LKR' } as any, 'LKR', rates)
    expect(b.baseAmount).toBeUndefined(); expect(b.fxRate).toBeUndefined()
    expect(() => withBaseAmount({ amount: 1, currency: 'JPY' }, 'LKR', rates)).toThrow(/exchange rate/)
  })
  it('totals are computed in base currency from normalised transactions', () => {
    const usd = normalizeToBase(tx({ type: 'income', amount: 100, currency: 'USD', fxRate: 300, baseAmount: 30000, date: '2026-11-01' }))
    const lkr = normalizeToBase(tx({ type: 'income', amount: 5000, date: '2026-11-02' }))
    expect(usd).toMatchObject({ amount: 30000, originalAmount: 100 })
    expect(summarize([usd, lkr]).income).toBe(35000)
    expect(normalizeToBase(usd)).toBe(usd) // idempotent
  })
  it('conversion helpers', () => {
    expect(toBase(10, 'EUR', 'LKR', rates)).toBe(3250)
    expect(toBase(10, 'LKR', 'LKR', rates)).toBe(10)
    expect(invertRates({ USD: 0.003333 }, ['USD']).USD).toBeCloseTo(300.03, 1)
  })
})
