/**
 * Investment guidance — educational, rule-based and fully explained. Not financial advice.
 * Order of operations: (1) emergency fund, (2) high-cost debt, (3) invest a share of the
 * monthly surplus according to risk tolerance and horizon.
 */
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'
export interface RiskProfile { tolerance: RiskTolerance; horizonYears: number; experience: 'none' | 'some' | 'experienced' }

export interface AssetClass { id: string; label: string; expectedReturn: number; volatility: 'low' | 'medium' | 'high'; examples: string }

/** Long-run nominal LKR return assumptions (editable in one place; shown to the user). */
export const ASSET_CLASSES: AssetClass[] = [
  { id: 'cash', label: 'Cash & savings', expectedReturn: 0.05, volatility: 'low', examples: 'High-yield savings, money market funds' },
  { id: 'fixed', label: 'Fixed income', expectedReturn: 0.09, volatility: 'low', examples: 'Fixed deposits, T-bills, treasury bonds, debentures' },
  { id: 'equity', label: 'Equity', expectedReturn: 0.13, volatility: 'high', examples: 'Equity unit trusts, CSE index / blue-chip shares' },
  { id: 'gold', label: 'Gold', expectedReturn: 0.07, volatility: 'medium', examples: 'Gold savings accounts, gold funds' },
]

const BASE: Record<RiskTolerance, Record<string, number>> = {
  conservative: { cash: 20, fixed: 60, equity: 15, gold: 5 },
  moderate: { cash: 10, fixed: 40, equity: 40, gold: 10 },
  aggressive: { cash: 5, fixed: 20, equity: 65, gold: 10 },
}

/** Allocation % by asset class; short horizons and no experience shift towards fixed income. */
export function allocationFor(p: RiskProfile): Record<string, number> {
  const a = { ...BASE[p.tolerance] }
  const shift = (n: number) => { const s = Math.min(a.equity, n); a.equity -= s; a.fixed += s }
  if (p.horizonYears < 2) { const s = a.equity; a.equity = 0; a.fixed += Math.round(s * 0.7); a.cash += s - Math.round(s * 0.7) }
  else if (p.horizonYears < 5) shift(Math.round(a.equity * 0.4))
  if (p.experience === 'none') shift(Math.round(a.equity * 0.25))
  return a
}

export const expectedReturn = (alloc: Record<string, number>) =>
  ASSET_CLASSES.reduce((s, c) => s + (alloc[c.id] || 0) / 100 * c.expectedReturn, 0)

/** Future value of an initial amount plus monthly contributions at an annual rate (monthly compounding). */
export function futureValue(initial: number, monthly: number, years: number, annualRate: number): number {
  const n = Math.round(years * 12), i = annualRate / 12
  if (i === 0) return initial + monthly * n
  return initial * Math.pow(1 + i, n) + monthly * ((Math.pow(1 + i, n) - 1) / i)
}

export interface AdvisorInput {
  profile: RiskProfile
  avgMonthlyIncome: number
  avgMonthlyExpenses: number
  availableCash: number
  /** Liabilities on credit cards / loans */
  debt: number
  investedValue: number
  holdings: { name: string; amount: number; currentValue?: number; purchaseDate?: string | null }[]
  /** Months of expenses to hold as an emergency fund (default 6) */
  emergencyMonths?: number
  today: string
}

export interface AdvisorPlan {
  stage: 'build_emergency_fund' | 'pay_debt' | 'invest'
  emergencyTarget: number
  emergencyShortfall: number
  monthlySurplus: number
  suggestedMonthlyInvestment: number
  suggestedMonthlyEmergency: number
  allocation: { id: string; label: string; pct: number; monthly: number; examples: string }[]
  expectedAnnualReturn: number
  scenarios: { label: string; rate: number; value: number; contributed: number }[]
  holdings: { name: string; invested: number; value: number; gain: number; roi: number; annualized: number | null }[]
  steps: string[]
}

export function investmentPlan(i: AdvisorInput): AdvisorPlan {
  const months = i.emergencyMonths ?? 6
  const emergencyTarget = Math.round(i.avgMonthlyExpenses * months)
  const emergencyShortfall = Math.max(0, emergencyTarget - i.availableCash)
  const surplus = Math.max(0, Math.round(i.avgMonthlyIncome - i.avgMonthlyExpenses))
  const steps: string[] = []

  let stage: AdvisorPlan['stage'] = 'invest'
  let toEmergency = 0, toInvest = 0
  if (!i.avgMonthlyExpenses) steps.push('Record at least one full month of expenses so the emergency-fund target can be calculated.')
  if (emergencyShortfall > 0) {
    stage = 'build_emergency_fund'
    toEmergency = Math.round(surplus * 0.7); toInvest = Math.round(surplus * 0.1)
    steps.push(`Build an emergency fund of ${months} months of expenses (${emergencyTarget.toLocaleString()}); ${emergencyShortfall.toLocaleString()} to go.`)
    if (toEmergency > 0) steps.push(`Put about ${toEmergency.toLocaleString()} a month into a separate savings account — reached in ≈${Math.ceil(emergencyShortfall / toEmergency)} months.`)
  } else if (i.debt > 0) {
    stage = 'pay_debt'
    toInvest = Math.round(surplus * 0.3)
    steps.push(`Pay down ${i.debt.toLocaleString()} of card/loan debt first — its interest is usually higher than any expected investment return.`)
  } else {
    toInvest = Math.round(surplus * 0.6)
    steps.push(`Your emergency fund is in place. Investing ≈60% of your monthly surplus (${toInvest.toLocaleString()}) keeps the rest for goals and buffers.`)
  }
  if (!surplus) steps.push('There is no monthly surplus yet — reduce spending or raise income before investing.')

  const alloc = allocationFor(i.profile)
  const er = expectedReturn(alloc)
  const allocation = ASSET_CLASSES.map(c => ({ id: c.id, label: c.label, pct: alloc[c.id] || 0, monthly: Math.round(toInvest * (alloc[c.id] || 0) / 100), examples: c.examples })).filter(a => a.pct > 0)
  const years = Math.max(1, i.profile.horizonYears)
  const contributed = Math.round(i.investedValue + toInvest * years * 12)
  const scen = (label: string, rate: number) => ({ label, rate: Math.round(rate * 1000) / 10, value: Math.round(futureValue(i.investedValue, toInvest, years, rate)), contributed })
  const scenarios = [scen('Pessimistic', Math.max(0, er - 0.05)), scen('Expected', er), scen('Optimistic', er + 0.03)]
  steps.push(`Mix for a ${i.profile.tolerance} profile over ${years} year${years > 1 ? 's' : ''}: ${allocation.map(a => `${a.label} ${a.pct}%`).join(', ')}.`)
  steps.push('Diversify, prefer low-cost funds, and review once a year. Returns are assumptions, not promises.')

  const holdings = i.holdings.map(h => {
    const invested = Number(h.amount) || 0
    const value = Number(h.currentValue) || invested
    const gain = value - invested
    const roi = invested ? gain / invested : 0
    let annualized: number | null = null
    if (h.purchaseDate && invested > 0 && value > 0) {
      const yrs = (new Date(i.today).getTime() - new Date(h.purchaseDate).getTime()) / (365.25 * 864e5)
      if (yrs >= 0.25) annualized = Math.pow(value / invested, 1 / yrs) - 1
    }
    return { name: h.name, invested, value, gain, roi: Math.round(roi * 1000) / 10, annualized: annualized == null ? null : Math.round(annualized * 1000) / 10 }
  })

  return {
    stage, emergencyTarget, emergencyShortfall, monthlySurplus: surplus,
    suggestedMonthlyInvestment: toInvest, suggestedMonthlyEmergency: toEmergency,
    allocation, expectedAnnualReturn: Math.round(er * 1000) / 10, scenarios, holdings, steps,
  }
}
