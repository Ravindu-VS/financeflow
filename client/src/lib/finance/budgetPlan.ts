/**
 * Budget workflows. All methods read the same transactions; they differ in how the plan is built.
 *  - category      : a limit per category (sum = plan)
 *  - monthly       : one spending limit for everything
 *  - flexible      : fixed commitments are ring-fenced; the rest is one flexible pool
 *  - savings_first : savings & investment targets come off the top ("pay yourself first")
 *  - zero_based    : every rupee of income is assigned (categories + savings + investments = income)
 */
export type BudgetMethod = 'category' | 'monthly' | 'flexible' | 'savings_first' | 'zero_based'

export interface BudgetPlanInput {
  method: BudgetMethod
  /** Expected income for the month (recorded so far, or expected recurring income if higher) */
  income: number
  /** Monthly fixed commitments: fixed recurring expenses + monthly provision for non-monthly bills */
  fixedCommitments: number
  savingsTarget: number
  investmentTarget: number
  savingsDone: number
  investmentsDone: number
  monthlyBudget?: number
  categoryBudgets: { category: string; amount: number }[]
  /** Net spending this month */
  spent: number
  /** Spending on fixed/recurring items this month */
  fixedSpent: number
  daysLeft: number
}

export interface BudgetPlan {
  method: BudgetMethod
  /** Total that may be spent this month under the method */
  spendingPlan: number
  spent: number
  remaining: number
  perDay: number
  /** flexible: the pool after fixed costs; savings_first: income after savings */
  flexiblePool?: number
  flexibleSpent?: number
  /** zero_based: income − (categories + savings + investments). Must be 0 for a balanced plan. */
  unassigned?: number
  assigned?: number
  /** savings_first: what still has to be moved to savings/investments this month */
  payYourselfFirstDue?: number
  status: 'ok' | 'warning' | 'over' | 'incomplete'
  messages: string[]
}

const r = (n: number) => Math.round(n)

export function buildBudgetPlan(i: BudgetPlanInput): BudgetPlan {
  const catTotal = i.categoryBudgets.reduce((s, b) => s + (b.amount || 0), 0)
  const commitments = i.savingsTarget + i.investmentTarget
  const messages: string[] = []
  let spendingPlan = 0
  const extra: Partial<BudgetPlan> = {}

  switch (i.method) {
    case 'category':
      spendingPlan = catTotal
      if (!catTotal) messages.push('Add category budgets to start tracking against a plan.')
      break
    case 'monthly':
      spendingPlan = i.monthlyBudget || 0
      if (!spendingPlan) messages.push('Set a monthly spending limit in Planning.')
      break
    case 'flexible': {
      const pool = i.income - i.fixedCommitments - commitments
      spendingPlan = i.fixedCommitments + Math.max(0, pool)
      extra.flexiblePool = r(Math.max(0, pool))
      extra.flexibleSpent = r(Math.max(0, i.spent - i.fixedSpent))
      if (pool < 0) messages.push(`Fixed costs and targets exceed income by ${r(-pool)} — there is no flexible money this month.`)
      else messages.push(`${r(pool)} is flexible after fixed costs (${r(i.fixedCommitments)}) and targets (${r(commitments)}).`)
      break
    }
    case 'savings_first': {
      const due = Math.max(0, i.savingsTarget - i.savingsDone) + Math.max(0, i.investmentTarget - i.investmentsDone)
      spendingPlan = Math.max(0, i.income - commitments)
      extra.payYourselfFirstDue = r(due)
      extra.flexiblePool = r(spendingPlan)
      if (!commitments) messages.push('Set a monthly savings or investment target in Planning — savings-first needs one.')
      else if (due > 0) messages.push(`Move ${r(due)} to savings/investments first — then spend the rest.`)
      else messages.push('Savings and investment targets are done for this month.')
      break
    }
    case 'zero_based': {
      const assigned = catTotal + commitments
      const unassigned = i.income - assigned
      spendingPlan = catTotal
      extra.assigned = r(assigned)
      extra.unassigned = r(unassigned)
      if (!i.income) messages.push('Zero-based budgeting needs this month\'s income recorded or an expected recurring income.')
      else if (Math.abs(unassigned) < 1) messages.push('Every rupee is assigned — the plan is balanced.')
      else if (unassigned > 0) messages.push(`${r(unassigned)} of income is not assigned yet. Give it a job (a category, savings or investment).`)
      else messages.push(`You assigned ${r(-unassigned)} more than your income. Reduce some budgets.`)
      break
    }
  }

  const remaining = spendingPlan - i.spent
  const perDay = i.daysLeft > 0 ? Math.max(0, remaining) / i.daysLeft : 0
  let status: BudgetPlan['status'] = 'ok'
  if (!spendingPlan || (i.method === 'zero_based' && Math.abs(extra.unassigned || 0) >= 1)) status = 'incomplete'
  if (spendingPlan && i.spent > spendingPlan) status = 'over'
  else if (spendingPlan && i.spent > spendingPlan * 0.85) status = status === 'incomplete' ? status : 'warning'
  if (status === 'over') messages.unshift(`Over plan by ${r(i.spent - spendingPlan)}.`)

  return { method: i.method, spendingPlan: r(spendingPlan), spent: r(i.spent), remaining: r(remaining), perDay: r(perDay), status, messages, ...extra }
}
