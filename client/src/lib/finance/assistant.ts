/**
 * Grounding for the AI financial assistant.
 *
 * `buildFinancialContext` produces a compact, factual snapshot from actual data that is sent
 * to the LLM backend (so it never needs to guess numbers). `answerLocally` answers common
 * questions on-device when the backend is unreachable. Every answer separates
 * FACT / PREDICTION / RECOMMENDATION and states its basis.
 */
import type { Transaction, RecurringRule } from './types'
import { summarize, expensesByCategory, incomeByCategory, pctChange, round2 } from './aggregate'
import { makePeriod, todayKey } from './dates'
import { categoryLabel } from './categories'
import { generateInsights, analyzeBehavior } from './insights'
import { forecastMonthExpenses, goalRequiredMonthly, type SafeToSpendResult } from './planning'

export interface FinancialContext {
  generatedAt: string
  currency: string
  thisMonth: ReturnType<typeof summarize> & { label: string; topCategories: { category: string; total: number }[]; income: number }
  lastMonth: ReturnType<typeof summarize> & { label: string; topCategories: { category: string; total: number }[] }
  incomeSources: { category: string; total: number }[]
  forecast: ReturnType<typeof forecastMonthExpenses>
  safeToSpend?: Pick<SafeToSpendResult, 'safeToSpend' | 'dailyLimit' | 'availableCash' | 'upcomingBills' | 'daysLeft'>
  budgets: { category: string; amount: number; spent: number }[]
  goals: { name: string; target: number; current: number; deadline?: string; perMonth: number }[]
  behavior: ReturnType<typeof analyzeBehavior>
  insights: { kind: string; detail: string; basis: string }[]
  netWorth?: number
  rulesNote: string
}

export function buildFinancialContext(o: {
  transactions: Transaction[]; rules: RecurringRule[]; budgets: { category: string; amount: number }[]
  goals: { name: string; targetAmount: number; currentAmount: number; deadline?: string }[]
  safeToSpend?: SafeToSpendResult; netWorth?: number; today?: string
}): FinancialContext {
  const today = o.today || todayKey()
  const cur = makePeriod('this_month', today), prev = makePeriod('last_month', today)
  const ct = o.transactions.filter(t => t.date >= cur.start && t.date <= cur.end)
  const pt = o.transactions.filter(t => t.date >= prev.start && t.date <= prev.end)
  const cc = expensesByCategory(ct)
  return {
    generatedAt: today,
    currency: 'LKR',
    thisMonth: { label: cur.label, ...summarize(ct), topCategories: cc.slice(0, 6).map(c => ({ category: categoryLabel(c.category), total: c.total })) },
    lastMonth: { label: prev.label, ...summarize(pt), topCategories: expensesByCategory(pt).slice(0, 6).map(c => ({ category: categoryLabel(c.category), total: c.total })) },
    incomeSources: incomeByCategory(ct).map(c => ({ category: categoryLabel(c.category), total: c.total })),
    forecast: forecastMonthExpenses(o.transactions, o.rules, today),
    safeToSpend: o.safeToSpend && { safeToSpend: o.safeToSpend.safeToSpend, dailyLimit: o.safeToSpend.dailyLimit, availableCash: o.safeToSpend.availableCash, upcomingBills: o.safeToSpend.upcomingBills, daysLeft: o.safeToSpend.daysLeft },
    budgets: o.budgets.map(b => ({ category: categoryLabel(b.category), amount: b.amount, spent: cc.find(c => c.category === b.category)?.total || 0 })),
    goals: o.goals.map(g => ({ name: g.name, target: g.targetAmount, current: g.currentAmount, deadline: g.deadline, perMonth: goalRequiredMonthly(g.targetAmount, g.currentAmount, g.deadline, today).perMonth })),
    behavior: analyzeBehavior(ct, cur, o.transactions),
    insights: generateInsights({ all: o.transactions, current: cur, previous: prev, rules: o.rules, today }).map(i => ({ kind: i.kind, detail: i.detail, basis: i.basis })),
    netWorth: o.netWorth,
    rulesNote: 'Expenses are net of refunds. Transfers are excluded from income/expenses. Savings and investments are not expenses. Forecasts are estimates.',
  }
}

const f = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-LK')}`

export function answerLocally(question: string, c: FinancialContext): string {
  const q = question.toLowerCase()
  const tm = c.thisMonth, lm = c.lastMonth
  const out: string[] = []
  const fact = (s: string) => out.push(`**FACT** — ${s}`)
  const pred = (s: string) => out.push(`**PREDICTION** — ${s}`)
  const rec = (s: string) => out.push(`**SUGGESTION** — ${s}`)

  if (/safe|can i (afford|spend)|how much can/.test(q)) {
    if (c.safeToSpend) {
      fact(`Available cash in spendable accounts: ${f(c.safeToSpend.availableCash)}; upcoming essential bills this month: ${f(c.safeToSpend.upcomingBills)}.`)
      pred(`Safe to spend for the rest of ${tm.label}: about ${f(c.safeToSpend.safeToSpend)} (≈ ${f(c.safeToSpend.dailyLimit)}/day for ${c.safeToSpend.daysLeft} days). This is an estimate after bills, savings/investment targets and your emergency reserve.`)
    } else fact('Add your accounts and opening balances to calculate safe-to-spend.')
  } else if (/why.*(spend|spent) more|what changed|compared|vs last|difference/.test(q)) {
    const ch = pctChange(tm.netExpenses, lm.netExpenses)
    fact(`${tm.label}: spent ${f(tm.netExpenses)} vs ${f(lm.netExpenses)} in ${lm.label}${ch !== null ? ` (${ch >= 0 ? '+' : ''}${ch.toFixed(0)}%)` : ''}. Income ${f(tm.income)} vs ${f(lm.income)}.`)
    const lmMap = new Map(lm.topCategories.map(x => [x.category, x.total]))
    const movers = tm.topCategories.map(x => ({ ...x, diff: x.total - (lmMap.get(x.category) || 0) })).filter(x => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3)
    if (movers.length) fact(`Biggest increases: ${movers.map(m => `${m.category} +${f(m.diff)}`).join(', ')}.`)
    if (c.behavior.unexpected.largest) fact(`Largest unexpected expense: ${c.behavior.unexpected.largest.description || categoryLabel(c.behavior.unexpected.largest.category)} (${f(c.behavior.unexpected.largest.amount)}).`)
  } else if (/where.*(money|spend)|most of my money|biggest|top categor/.test(q)) {
    fact(`Top spending in ${tm.label}: ${tm.topCategories.map(x => `${x.category} ${f(x.total)} (${tm.netExpenses ? Math.round(x.total / tm.netExpenses * 100) : 0}%)`).join(', ') || 'no expenses yet'}.`)
  } else if (/how much.*sav|saved|savings rate/.test(q)) {
    fact(`${tm.label}: saved ${f(tm.savings)} and invested ${f(tm.investments)} — savings rate ${tm.savingsRate.toFixed(0)}% (last month ${lm.savingsRate.toFixed(0)}%).`)
  } else if (/goal/.test(q)) {
    if (c.goals.length) c.goals.forEach(g => fact(`${g.name}: ${f(g.current)} of ${f(g.target)}${g.perMonth ? ` — needs ${f(g.perMonth)}/month to reach by ${g.deadline}` : ''}.`))
    else fact('You have no savings goals yet.')
  } else if (/unnecessary|waste|cut|save money|reduce/.test(q)) {
    const disc = tm.topCategories.filter(x => /Dining|Entertainment|Shopping|Subscriptions|Travel|Personal/.test(x.category))
    fact(`Discretionary categories this month: ${disc.map(x => `${x.category} ${f(x.total)}`).join(', ') || 'none recorded'}. Small purchases: ${f(c.behavior.smallPurchases.total)} across ${c.behavior.smallPurchases.count}.`)
    if (disc[0]) rec(`Reducing ${disc[0].category} by 20% would save about ${f(disc[0].total * 0.2)} a month. Basis: your actual ${disc[0].category} spending this month.`)
  } else if (/behaviou?r|pattern|weekend|habit/.test(q)) {
    const b = c.behavior
    fact(`Weekend spending ${f(b.weekendAvgPerDay)}/day vs weekday ${f(b.weekdayAvgPerDay)}/day${b.weekendVsWeekdayPct !== null ? ` (${b.weekendVsWeekdayPct >= 0 ? '+' : ''}${b.weekendVsWeekdayPct.toFixed(0)}%)` : ''}.`)
    fact(`Small purchases under Rs. 1,000: ${b.smallPurchases.count} totalling ${f(b.smallPurchases.total)}.`)
    if (b.paydaySpending?.ratio) fact(`In the 3 days after payday you spent ${f(b.paydaySpending.windowTotal)} — ${b.paydaySpending.ratio.toFixed(1)}× a typical 3-day stretch.`)
  } else if (/predict|forecast|end of (the )?month|rest of/.test(q)) {
    pred(`Expected spending for ${tm.label}: ${f(c.forecast.expected)} (likely ${f(c.forecast.low)}–${f(c.forecast.high)}, confidence ${c.forecast.confidence}).`)
    out.push(`Basis: ${c.forecast.basis}`)
  } else if (/invest/.test(q)) {
    fact(`Invested this month: ${f(tm.investments)}. Monthly surplus after expenses: ${f(tm.netCashFlow)}.`)
    rec('General education, not personal advice: many people build an emergency fund (often 3–6 months of expenses) before taking investment risk, and diversify across asset types. Returns are never guaranteed.')
  } else {
    fact(`${tm.label} so far: income ${f(tm.income)}, expenses ${f(tm.netExpenses)}, saved ${f(tm.savings)}, invested ${f(tm.investments)}, net cash flow ${f(tm.netCashFlow)}.`)
    c.insights.slice(0, 3).forEach(i => out.push(`**${i.kind === 'fact' ? 'FACT' : i.kind === 'prediction' ? 'PREDICTION' : 'SUGGESTION'}** — ${i.detail} *(basis: ${i.basis})*`))
  }
  out.push('\n*Answered on-device from your recorded transactions.*')
  return out.join('\n\n')
}


