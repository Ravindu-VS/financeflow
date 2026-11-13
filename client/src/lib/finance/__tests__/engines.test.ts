import { describe, it, expect } from 'vitest'
import {
  parseReceiptText, parseReceiptDate, fitHolt, holtForecast, forecastMonthly, detectAnomalies,
  buildBudgetPlan, allocationFor, futureValue, investmentPlan, computeAlerts, pruneDismissed, resolveConcurrentEdit,
} from '..'
import type { Transaction, RecurringRule } from '..'

let seq = 0
const tx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>): Transaction => ({
  id: `e${++seq}`, currency: 'LKR', category: 'food_dining', status: 'cleared', source: 'manual', ...p,
})

describe('receipt parser', () => {
  const text = `KEELLS SUPER\nNo 12, Galle Road, Colombo 03\nTel: 011 2345678\nDate: 08/11/2026 14:32\nMilk 1L        450.00\nBread          180.00\nRice 5kg     1,650.00\nSUB TOTAL    2,280.00\nVAT            0.00\nGRAND TOTAL  2,280.00\nCASH         3,000.00\nCHANGE         720.00\nThank you!`
  it('reads total, day-first date, merchant and items', () => {
    const d = parseReceiptText(text, '2026-11-13')
    expect(d.amount).toBe(2280)
    expect(d.date).toBe('2026-11-08')
    expect(d.merchant).toBe('KEELLS SUPER')
    expect(d.items.map(i => i.amount)).toEqual([450, 180, 1650])
    expect(d.confidence).toBeGreaterThanOrEqual(0.9)
  })
  it('ignores CASH/CHANGE and subtotal lines when picking the total', () => {
    const d = parseReceiptText('Cafe Mocha\nSubtotal 900.00\nService 90.00\nTotal 990.00\nCash 1000.00\nChange 10.00', '2026-11-13')
    expect(d.amount).toBe(990)
    expect(d.warnings.some(w => /Date/.test(w))).toBe(true)
  })
  it('parses other date formats and rejects future dates', () => {
    expect(parseReceiptDate('2026-10-31', '2026-11-13')).toBe('2026-10-31')
    expect(parseReceiptDate('12 Nov 2026', '2026-11-13')).toBe('2026-11-12')
    expect(parseReceiptDate('Nov 3, 2026', '2026-11-13')).toBe('2026-11-03')
    expect(parseReceiptDate('20/12/2026', '2026-11-13')).toBeNull()
  })
})

describe('Holt forecasting', () => {
  it('follows a linear trend and gives sensible intervals', () => {
    const y = [100, 110, 120, 130, 140, 150, 160]
    const { points, fit } = holtForecast(y, 2)
    expect(fit.residualSd).toBeLessThan(5)
    expect(points[0].expected).toBeGreaterThan(160)
    expect(points[0].expected).toBeLessThan(175)
    expect(points[1].high - points[1].low).toBeGreaterThanOrEqual(points[0].high - points[0].low)
  })
  it('never forecasts negative spending', () => {
    const { points } = holtForecast([500, 300, 100, 50], 3)
    expect(points.every(p => p.low >= 0 && p.expected >= 0)).toBe(true)
  })
  it('fits a flat series with ~zero trend', () => {
    const f = fitHolt([200, 200, 200, 200])
    expect(Math.abs(f.trend)).toBeLessThan(1)
  })
  it('monthly forecast needs ≥3 months and labels months', () => {
    const txs = ['2026-07', '2026-08', '2026-09', '2026-10'].flatMap((m, i) => [
      tx({ type: 'expense', amount: 10000 + i * 1000, date: `${m}-10` }),
      tx({ type: 'income', amount: 50000, date: `${m}-01`, category: 'salary' }),
      tx({ type: 'transfer', amount: 99999, date: `${m}-05` }),
    ])
    const f = forecastMonthly(txs, '2026-11-13', 2)!
    expect(f.history.map(h => h.expenses)).toEqual([10000, 11000, 12000, 13000])
    expect(f.expenses[0].month).toBe('2026-11')
    expect(f.expenses[1].month).toBe('2026-12')
    expect(f.income[0].expected).toBe(50000)
    expect(forecastMonthly(txs.slice(0, 6), '2026-11-13')).toBeNull()
  })
})

describe('anomaly detection', () => {
  it('flags an expense far above the category norm, not normal ones', () => {
    const hist = [800, 900, 1000, 950, 1100, 850].map((a, i) => tx({ type: 'expense', amount: a, date: `2026-09-${10 + i}` }))
    const big = tx({ type: 'expense', amount: 6500, date: '2026-11-10' })
    const normal = tx({ type: 'expense', amount: 1050, date: '2026-11-11' })
    const a = detectAnomalies([...hist, big, normal], '2026-11-13')
    expect(a.map(x => x.transaction.id)).toEqual([big.id])
    expect(a[0].median).toBeGreaterThan(800)
  })
  it('needs enough history', () => {
    expect(detectAnomalies([tx({ type: 'expense', amount: 100, date: '2026-11-01' }), tx({ type: 'expense', amount: 9000, date: '2026-11-10' })], '2026-11-13')).toEqual([])
  })
})

describe('budget workflows', () => {
  const base = { income: 100000, fixedCommitments: 40000, savingsTarget: 15000, investmentTarget: 5000, savingsDone: 5000, investmentsDone: 0, categoryBudgets: [{ category: 'food_dining', amount: 30000 }, { category: 'transport', amount: 10000 }], spent: 50000, fixedSpent: 35000, daysLeft: 10 }
  it('flexible: ring-fences fixed costs and targets', () => {
    const p = buildBudgetPlan({ ...base, method: 'flexible' })
    expect(p.flexiblePool).toBe(40000)
    expect(p.flexibleSpent).toBe(15000)
    expect(p.spendingPlan).toBe(80000)
    expect(p.perDay).toBe(3000)
  })
  it('savings-first: takes targets off the top and reports what is still due', () => {
    const p = buildBudgetPlan({ ...base, method: 'savings_first' })
    expect(p.spendingPlan).toBe(80000)
    expect(p.payYourselfFirstDue).toBe(15000)
  })
  it('zero-based: unassigned income must be zero', () => {
    const p = buildBudgetPlan({ ...base, method: 'zero_based', spent: 20000 })
    expect(p.assigned).toBe(60000)
    expect(p.unassigned).toBe(40000)
    expect(p.status).toBe('incomplete')
    const balanced = buildBudgetPlan({ ...base, method: 'zero_based', spent: 20000, categoryBudgets: [{ category: 'x', amount: 80000 }] })
    expect(balanced.unassigned).toBe(0)
    expect(balanced.status).toBe('ok')
  })
  it('over plan is flagged', () => {
    expect(buildBudgetPlan({ ...base, method: 'category', spent: 45000 }).status).toBe('over')
  })
})

describe('investment advisor', () => {
  it('future value with monthly compounding', () => {
    expect(Math.round(futureValue(0, 1000, 1, 0))).toBe(12000)
    expect(Math.round(futureValue(10000, 0, 1, 0.12))).toBe(11268)
  })
  it('short horizon removes equity; no experience reduces it', () => {
    expect(allocationFor({ tolerance: 'aggressive', horizonYears: 1, experience: 'experienced' }).equity).toBe(0)
    const a = allocationFor({ tolerance: 'moderate', horizonYears: 10, experience: 'none' })
    expect(a.equity).toBeLessThan(40)
    expect(Object.values(a).reduce((s, n) => s + n, 0)).toBe(100)
  })
  it('emergency fund comes first', () => {
    const p = investmentPlan({ profile: { tolerance: 'moderate', horizonYears: 10, experience: 'some' }, avgMonthlyIncome: 150000, avgMonthlyExpenses: 100000, availableCash: 200000, debt: 0, investedValue: 0, holdings: [], today: '2026-11-13' })
    expect(p.stage).toBe('build_emergency_fund')
    expect(p.emergencyShortfall).toBe(400000)
    expect(p.suggestedMonthlyEmergency).toBe(35000)
    expect(p.scenarios[0].value).toBeLessThan(p.scenarios[2].value)
  })
  it('invests when the fund is in place, and computes holding ROI', () => {
    const p = investmentPlan({ profile: { tolerance: 'moderate', horizonYears: 10, experience: 'some' }, avgMonthlyIncome: 150000, avgMonthlyExpenses: 100000, availableCash: 700000, debt: 0, investedValue: 100000, holdings: [{ name: 'Fund', amount: 100000, currentValue: 121000, purchaseDate: '2024-11-13' }], today: '2026-11-13' })
    expect(p.stage).toBe('invest')
    expect(p.suggestedMonthlyInvestment).toBe(30000)
    expect(p.holdings[0].roi).toBe(21)
    expect(p.holdings[0].annualized).toBeCloseTo(10, 0)
  })
})

describe('alerts', () => {
  const rule = { id: 'r1', type: 'expense', amount: 5000, currency: 'LKR', category: 'utilities', description: 'Electricity', frequency: 'monthly', startDate: '2026-01-15', autoGenerate: false, active: true } as RecurringRule
  it('bills, budgets, goals, unusual and safe-to-spend', () => {
    const a = computeAlerts({
      today: '2026-11-13', formatMoney: n => `Rs.${n}`,
      upcoming: [{ rule, date: '2026-11-15' }, { rule, date: '2026-11-30' }],
      budgets: [{ category: 'food', label: 'Food', amount: 1000, spent: 1200, threshold: 80 }, { category: 'tr', label: 'Transport', amount: 1000, spent: 850, threshold: 80 }, { category: 'x', label: 'X', amount: 1000, spent: 100, threshold: 80 }],
      goals: [{ id: 'g', name: 'Trip', deadline: '2026-12-01', pct: 40, perMonth: 1000 }],
      anomalies: [{ id: 't9', label: 'Dinner', amount: 9000, reason: '5× usual' }],
      safeToSpend: { amount: 2000, perDay: 100 }, lowSafeToSpendPerDay: 500,
    })
    expect(a.map(x => x.kind).sort()).toEqual(['bill', 'budget', 'budget', 'goal', 'safe_to_spend', 'unusual'])
    expect(a[0].severity).toBe('danger')
    expect(a.find(x => x.kind === 'bill')!.id).toBe('bill_r1_2026-11-15')
  })
  it('prunes old dismissed ids', () => {
    expect(pruneDismissed(['bill_r_2026-01-01', 'bill_r_2026-11-01', 'goal_g_overdue'], '2026-11-13')).toEqual(['bill_r_2026-11-01', 'goal_g_overdue'])
  })
})

describe('concurrent edits', () => {
  const before = tx({ type: 'expense', amount: 100, date: '2026-11-01', description: 'a', updatedAt: '2026-11-01T10:00:00.000Z' })
  it('no change elsewhere → no conflict', () => {
    expect(resolveConcurrentEdit(before, before, { amount: 200 }).conflicts).toEqual([])
  })
  it('different fields changed elsewhere → rebase without conflict', () => {
    const stored = { ...before, description: 'b', updatedAt: '2026-11-01T11:00:00.000Z' }
    const r = resolveConcurrentEdit(before, stored, { amount: 200 })
    expect(r.conflicts).toEqual([])
    expect(r.base!.description).toBe('b')
  })
  it('same field changed elsewhere → conflict', () => {
    const stored = { ...before, amount: 150, updatedAt: '2026-11-01T11:00:00.000Z' }
    expect(resolveConcurrentEdit(before, stored, { amount: 200 }).conflicts).toEqual(['amount'])
    expect(resolveConcurrentEdit(before, null, { amount: 200 }).deleted).toBe(true)
  })
})
