import { useMemo } from 'react'
import { usePeriodStore } from '../store/periodStore'
import { useFinanceStore, usePeriodTransactions, useBalances } from '../store/financeStore'
import {
  summarize, previousPeriod, expensesByCategory, incomeByCategory, availableCash, netWorth, safeToSpend,
  todayKey, startOfMonth, generateInsights, upcomingOccurrences, goalRequiredMonthly, legacyToDateKey,
  forecastMonthExpenses, forecastCategory, pctChange, diffDays, addDays, addMonths, type Period, type PeriodSummary,
} from '../lib/finance'

export interface BudgetStatus { id: string; name: string; category: string; amount: number; spent: number; remaining: number; pct: number; forecast?: number }

/** Everything the period-aware screens need, computed once from actual transactions. */
export function usePeriodData(periodOverride?: Period) {
  const storePeriod = usePeriodStore(s => s.period)
  const period = periodOverride || storePeriod
  const prev = useMemo(() => previousPeriod(period), [period.start, period.end])
  const { txs, loading } = usePeriodTransactions(period)
  const { txs: prevTxs } = usePeriodTransactions(prev)
  const { accounts, rules, budgets, goals, holdings, settings, transactions, windowStart } = useFinanceStore()
  const balances = useBalances()
  const today = todayKey()
  const isCurrentMonth = period.unit === 'month' && period.start === startOfMonth(today)

  return useMemo(() => {
    const summary: PeriodSummary = summarize(txs)
    const previous: PeriodSummary = summarize(prevTxs)
    // While a period is in progress, compare like-for-like: the same number of elapsed days
    // of the previous period (e.g. Nov 1–7 vs Oct 1–7), not a partial vs a full period.
    const inProgress = period.start <= today && today < period.end
    const prevCutoff = inProgress ? addDays(prev.start, diffDays(period.start, today)) : prev.end
    const previousToDate: PeriodSummary = inProgress ? summarize(prevTxs.filter(t => t.date <= prevCutoff)) : previous
    const byCategory = expensesByCategory(txs)
    const byIncome = incomeByCategory(txs)
    const cash = availableCash(accounts, balances)
    const holdingsValue = holdings.filter(h => h.status !== 'sold').reduce((s, h) => s + (Number(h.currentValue) || Number(h.amount) || 0), 0)
    const nw = netWorth(accounts, balances, holdingsValue)

    // Budgets scale to the selected period: monthly budgets × number of months covered (approx for non-month periods)
    const totalDays = diffDays(period.start, period.end) + 1
    const months = Math.max(1, Math.round(totalDays / 30.4375))
    const factor = period.unit === 'month' ? 1 : period.unit === 'week' ? 7 / 30.4375 : period.unit === 'day' ? 1 / 30.4375 : months
    const budgetStatus: BudgetStatus[] = budgets.map(b => {
      const amount = Math.round(b.amount * factor)
      const spent = byCategory.find(c => c.category === b.category)?.total || 0
      const oneOff = txs.filter(t => t.type === 'expense' && t.status !== 'void' && t.category === b.category && (t.kind === 'one_time' || t.kind === 'unexpected' || t.kind === 'emergency')).reduce((a, t) => a + t.amount, 0)
      const forecast = isCurrentMonth ? Math.round(forecastCategory(spent, today, undefined, oneOff)) : undefined
      return { id: b.id, name: b.name || b.category, category: b.category, amount, spent, remaining: amount - spent, pct: amount ? Math.round(spent / amount * 100) : 0, forecast }
    }).sort((a, b) => b.pct - a.pct)
    const totalBudget = settings.budgetMethod === 'monthly' && settings.monthlyBudget ? Math.round(settings.monthlyBudget * factor) : budgetStatus.reduce((s, b) => s + b.amount, 0)
    const remainingBudget = totalBudget ? totalBudget - summary.netExpenses : null

    const savingsDone = isCurrentMonth ? summary.savings : 0
    const investDone = isCurrentMonth ? summary.investments : 0
    const sts = safeToSpend({
      availableCash: cash, rules, today,
      savingsCommitment: Math.max(0, settings.monthlySavingsTarget - savingsDone),
      investmentCommitment: Math.max(0, settings.monthlyInvestmentTarget - investDone),
      emergencyReserve: settings.emergencyReserve,
    })

    const upcoming = upcomingOccurrences(rules.filter(r => r.type === 'expense' || r.type === 'income'), today, 30)
      .filter(o => !o.rule.lastGeneratedDate || o.date > o.rule.lastGeneratedDate)

    const goalProgress = goals.map(g => {
      const deadline = legacyToDateKey(g.targetDate) || undefined
      const req = goalRequiredMonthly(Number(g.targetAmount) || 0, Number(g.currentAmount) || 0, deadline, today)
      const pct = g.targetAmount ? Math.min(100, Math.round((Number(g.currentAmount) || 0) / Number(g.targetAmount) * 100)) : 0
      return { ...g, deadline, ...req, pct }
    })

    const insights = generateInsights({
      all: prev.start >= windowStart ? transactions : [...txs, ...prevTxs],
      current: period, previous: prev, rules, today,
      budgets: budgetStatus.map(b => ({ category: b.category, amount: b.amount, spent: b.spent })),
    })
    const forecast = isCurrentMonth ? forecastMonthExpenses(transactions, rules, today) : null

    // Financial health (transparent, rule-based)
    const avgMonthlyExpense = (() => {
      const from = addMonths(startOfMonth(today), -3, 1)
      const hist = transactions.filter(t => t.date < startOfMonth(today) && t.date >= from)
      const monthsWithData = new Set(hist.map(t => t.date.slice(0, 7))).size
      return monthsWithData ? summarize(hist).netExpenses / monthsWithData : 0
    })()
    const reserveMonths = avgMonthlyExpense > 0 ? cash / avgMonthlyExpense : null
    const overBudget = budgetStatus.filter(b => b.amount && b.spent > b.amount).length
    let score = 40
    const factors: { label: string; points: number; detail: string }[] = []
    const sr = summary.income ? summary.savingsRate : 0
    const srPts = sr >= 20 ? 25 : sr >= 10 ? 15 : sr > 0 ? 8 : 0; score += srPts
    factors.push({ label: 'Savings rate', points: srPts, detail: `${sr.toFixed(0)}% of income saved or invested` })
    const cfPts = summary.netCashFlow >= 0 ? 15 : 0; score += cfPts
    factors.push({ label: 'Cash flow', points: cfPts, detail: summary.netCashFlow >= 0 ? 'Spending within income' : 'Spending exceeded income' })
    const rPts = reserveMonths == null ? 0 : reserveMonths >= 6 ? 20 : reserveMonths >= 3 ? 12 : reserveMonths >= 1 ? 6 : 0; score += rPts
    factors.push({ label: 'Cash reserve', points: rPts, detail: reserveMonths == null ? 'Not enough history' : `${reserveMonths.toFixed(1)} months of expenses available` })
    const bPts = budgetStatus.length ? Math.max(0, 10 - overBudget * 4) : 5; score += bPts - 10
    factors.push({ label: 'Budgets', points: bPts, detail: budgetStatus.length ? `${overBudget} over budget` : 'No budgets set' })
    const health = { score: Math.max(0, Math.min(100, score)), factors }

    return {
      period, prev, loading, txs, prevTxs, summary, previous, byCategory, byIncome, cash, netWorth: nw, holdingsValue,
      budgetStatus, totalBudget, remainingBudget, safeToSpend: sts, upcoming, goalProgress, insights, forecast, health,
      isCurrentMonth, accounts, balances, rules, settings,
      previousToDate, comparisonLabel: inProgress ? 'vs same point last period' : 'vs previous period',
      change: {
        income: pctChange(summary.income, previousToDate.income),
        expenses: pctChange(summary.netExpenses, previousToDate.netExpenses),
        savings: pctChange(summary.savings, previousToDate.savings),
        investments: pctChange(summary.investments, previousToDate.investments),
        netCashFlow: pctChange(summary.netCashFlow, previousToDate.netCashFlow),
      },
    }
  }, [txs, prevTxs, accounts, balances, rules, budgets, goals, holdings, settings, transactions, windowStart, period, prev, loading])
}

