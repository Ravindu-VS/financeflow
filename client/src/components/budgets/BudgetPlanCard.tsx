import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionHeader } from '../ui'
import { usePeriodData } from '../../hooks/useFinance'
import { useFinanceStore } from '../../store/financeStore'
import { buildBudgetPlan, monthlyEquivalent, nonMonthlyProvisions, todayKey, endOfMonth, diffDays, type BudgetMethod } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'

const LABEL: Record<BudgetMethod, string> = {
  category: 'Category budgets', monthly: 'Single monthly limit', flexible: 'Flexible (fixed costs ring-fenced)',
  savings_first: 'Savings-first (pay yourself first)', zero_based: 'Zero-based (every rupee assigned)',
}
const STATUS: Record<string, string> = { ok: 'bg-green-500', warning: 'bg-amber-500', over: 'bg-red-500', incomplete: 'bg-gray-400' }

/** The active budgeting method applied to this month's actual numbers. */
export default function BudgetPlanCard() {
  const d = usePeriodData()
  const { budgets, rules, settings } = useFinanceStore()
  const today = todayKey()
  const plan = useMemo(() => {
    const active = rules.filter(r => r.active && (!r.endDate || r.endDate >= today))
    const monthlyRules = active.filter(r => r.type === 'expense' && (r.frequency === 'monthly' || r.frequency === 'weekly' || r.frequency === 'biweekly' || r.frequency === 'daily'))
    const provisions = nonMonthlyProvisions(active, today).reduce((s, p) => s + p.monthlyProvision, 0)
    const fixedCommitments = monthlyRules.filter(r => r.isBill || r.isEssential || !r.variableAmount).reduce((s, r) => s + monthlyEquivalent(r), 0) + provisions
    const expectedIncome = active.filter(r => r.type === 'income').reduce((s, r) => s + monthlyEquivalent(r), 0)
    const fixedSpent = d.txs.filter(t => t.type === 'expense' && t.status !== 'void' && (t.recurrenceId || t.nature === 'fixed')).reduce((s, t) => s + t.amount, 0)
    return buildBudgetPlan({
      method: settings.budgetMethod as BudgetMethod,
      income: Math.max(d.summary.income, expectedIncome),
      fixedCommitments, fixedSpent,
      savingsTarget: settings.monthlySavingsTarget, investmentTarget: settings.monthlyInvestmentTarget,
      savingsDone: d.summary.savings, investmentsDone: d.summary.investments,
      monthlyBudget: settings.monthlyBudget,
      categoryBudgets: budgets.map(b => ({ category: b.category, amount: Number(b.amount) || 0 })),
      spent: d.summary.netExpenses,
      daysLeft: diffDays(today, endOfMonth(today)) + 1,
    })
  }, [d, budgets, rules, settings, today])

  if (!d.isCurrentMonth) return null
  const pct = plan.spendingPlan ? Math.min(100, Math.round(plan.spent / plan.spendingPlan * 100)) : 0

  return (
    <Card>
      <SectionHeader title="This month's plan" subtitle={<span>{LABEL[plan.method]} · <Link to="/planning" className="text-primary-500">change method</Link></span>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div><p className="text-xs text-gray-500">Spending plan</p><p className="text-lg font-bold tabular-nums">{formatCurrency(plan.spendingPlan)}</p></div>
        <div><p className="text-xs text-gray-500">Spent</p><p className="text-lg font-bold tabular-nums">{formatCurrency(plan.spent)}</p></div>
        <div><p className="text-xs text-gray-500">{plan.remaining >= 0 ? 'Left' : 'Over'}</p><p className={`text-lg font-bold tabular-nums ${plan.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Math.abs(plan.remaining))}</p></div>
        <div><p className="text-xs text-gray-500">Per day left</p><p className="text-lg font-bold tabular-nums">{formatCurrency(plan.perDay)}</p></div>
        {plan.flexiblePool != null && <div><p className="text-xs text-gray-500">{plan.method === 'savings_first' ? 'After savings' : 'Flexible pool'}</p><p className="font-semibold tabular-nums">{formatCurrency(plan.flexiblePool)}</p></div>}
        {plan.flexibleSpent != null && <div><p className="text-xs text-gray-500">Flexible spent</p><p className="font-semibold tabular-nums">{formatCurrency(plan.flexibleSpent)}</p></div>}
        {plan.payYourselfFirstDue != null && <div><p className="text-xs text-gray-500">Still to save/invest</p><p className={`font-semibold tabular-nums ${plan.payYourselfFirstDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>{formatCurrency(plan.payYourselfFirstDue)}</p></div>}
        {plan.unassigned != null && <div><p className="text-xs text-gray-500">Unassigned income</p><p className={`font-semibold tabular-nums ${Math.abs(plan.unassigned) >= 1 ? 'text-amber-600' : 'text-green-600'}`}>{formatCurrency(plan.unassigned)}</p></div>}
      </div>
      <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${STATUS[plan.status]}`} style={{ width: `${pct}%` }} /></div>
      <ul className="mt-3 space-y-1">{plan.messages.map((m, i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-300">• {m}</li>)}</ul>
    </Card>
  )
}
