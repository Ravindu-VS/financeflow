/**
 * Behavioural analytics & smart insights.
 * Every insight is derived from actual transactions and labelled as FACT, PREDICTION or RECOMMENDATION,
 * with the numbers it is based on (so the AI never invents figures).
 */
import type { PeriodRange, RecurringRule, Transaction } from './types'
import { expensesByCategory, isCounted, pctChange, round2, summarize, weekdayWeekendSplit } from './aggregate'
import { addDays, diffDays, isWeekend, parseDateKey, startOfMonth } from './dates'
import { categoryLabel } from './categories'
import { forecastMonthExpenses, forecastCategory } from './planning'

export type InsightKind = 'fact' | 'prediction' | 'recommendation'
export type InsightTone = 'positive' | 'negative' | 'neutral' | 'warning'

export interface Insight {
  id: string
  kind: InsightKind
  tone: InsightTone
  title: string
  detail: string
  basis: string
  value?: number
}

export const SMALL_PURCHASE_LIMIT = 1000 // LKR — "small frequent expense" threshold

export interface BehaviorReport {
  weekdayAvgPerDay: number
  weekendAvgPerDay: number
  weekendVsWeekdayPct: number | null
  smallPurchases: { count: number; total: number }
  largeOccasional: Transaction[]
  unexpected: { count: number; total: number; largest?: Transaction }
  paydaySpending: { windowTotal: number; otherAvgPer3Days: number; ratio: number | null } | null
  spikes: { date: string; total: number }[]
  incomeVariability: number | null // coefficient of variation of monthly income, %
  savingsConsistency: number // share of months with a positive savings contribution, %
  investmentConsistency: number
}

export function analyzeBehavior(txs: Transaction[], r: PeriodRange, history: Transaction[] = txs): BehaviorReport {
  const p = txs.filter(t => isCounted(t) && t.date >= r.start && t.date <= r.end)
  const exp = p.filter(t => t.type === 'expense')

  // weekday vs weekend, normalised per calendar day in the period
  let wdDays = 0, weDays = 0
  for (let k = r.start; k <= r.end; k = addDays(k, 1)) isWeekend(k) ? weDays++ : wdDays++
  const split = weekdayWeekendSplit(exp)
  const wdAvg = wdDays ? split.weekday / wdDays : 0
  const weAvg = weDays ? split.weekend / weDays : 0

  const small = exp.filter(t => t.amount < SMALL_PURCHASE_LIMIT)
  const amounts = exp.map(t => t.amount).sort((a, b) => a - b)
  const p90 = amounts.length >= 5 ? amounts[Math.floor(amounts.length * 0.9)] : Infinity
  const large = exp.filter(t => t.amount >= p90 && t.amount >= SMALL_PURCHASE_LIMIT * 5).sort((a, b) => b.amount - a.amount)

  const unexpected = exp.filter(t => t.kind === 'unexpected' || t.kind === 'emergency' || t.category === 'emergency')
  const largestUnexpected = [...unexpected].sort((a, b) => b.amount - a.amount)[0]

  // payday: spending in the 3 days starting on the largest salary credit
  const salary = p.filter(t => t.type === 'income' && t.category === 'salary').sort((a, b) => b.amount - a.amount)[0]
  let payday: BehaviorReport['paydaySpending'] = null
  if (salary) {
    const wEnd = addDays(salary.date, 2)
    const windowTotal = exp.filter(t => t.date >= salary.date && t.date <= wEnd).reduce((s, t) => s + t.amount, 0)
    const otherTotal = exp.filter(t => t.date < salary.date || t.date > wEnd).reduce((s, t) => s + t.amount, 0)
    const otherDays = Math.max(1, diffDays(r.start, r.end) + 1 - 3)
    const otherAvg = (otherTotal / otherDays) * 3
    payday = { windowTotal: round2(windowTotal), otherAvgPer3Days: round2(otherAvg), ratio: otherAvg ? round2(windowTotal / otherAvg) : null }
  }

  // spikes: days with spending > mean + 2σ (min 3 spending days)
  const byDay = new Map<string, number>()
  for (const t of exp) byDay.set(t.date, (byDay.get(t.date) || 0) + t.amount)
  const vals = [...byDay.values()]
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const sd = vals.length > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1)) : 0
  const spikes = vals.length >= 3 ? [...byDay.entries()].filter(([, v]) => v > mean + 2 * sd).map(([date, total]) => ({ date, total: round2(total) })) : []

  // monthly consistency from full history (last 6 months)
  const months = lastNMonths(r.end, 6)
  const monthStats = months.map(m => summarize(history.filter(t => isCounted(t) && t.date.startsWith(m))))
  const incomes = monthStats.map(s => s.income).filter(x => x > 0)
  const incMean = incomes.length ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0
  const incSd = incomes.length > 1 ? Math.sqrt(incomes.reduce((s, v) => s + (v - incMean) ** 2, 0) / (incomes.length - 1)) : 0
  const activeMonths = monthStats.filter(s => s.count > 0).length || 1

  return {
    weekdayAvgPerDay: round2(wdAvg),
    weekendAvgPerDay: round2(weAvg),
    weekendVsWeekdayPct: wdAvg ? round2(((weAvg - wdAvg) / wdAvg) * 100) : null,
    smallPurchases: { count: small.length, total: round2(small.reduce((s, t) => s + t.amount, 0)) },
    largeOccasional: large.slice(0, 5),
    unexpected: { count: unexpected.length, total: round2(unexpected.reduce((s, t) => s + t.amount, 0)), largest: largestUnexpected },
    paydaySpending: payday,
    spikes,
    incomeVariability: incomes.length >= 2 && incMean ? round2((incSd / incMean) * 100) : null,
    savingsConsistency: round2((monthStats.filter(s => s.savings > 0).length / activeMonths) * 100),
    investmentConsistency: round2((monthStats.filter(s => s.investments > 0).length / activeMonths) * 100),
  }
}

function lastNMonths(endKey: string, n: number): string[] {
  const d = parseDateKey(startOfMonth(endKey))
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1, 12)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

const fmt = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-LK')}`

/** Generate smart insights comparing the current period to the previous one. */
export function generateInsights(opts: {
  all: Transaction[]
  current: PeriodRange
  previous: PeriodRange
  rules?: RecurringRule[]
  today: string
  budgets?: { category: string; amount: number; spent: number }[]
}): Insight[] {
  const { all, current, previous, rules = [], today } = opts
  const cur = all.filter(t => isCounted(t) && t.date >= current.start && t.date <= current.end)
  // like-for-like while the current period is still running
  const inProgress = current.start <= today && today < current.end
  const prevEnd = inProgress ? addDays(previous.start, diffDays(current.start, today)) : previous.end
  const prev = all.filter(t => isCounted(t) && t.date >= previous.start && t.date <= prevEnd)
  const sc = summarize(cur), sp = summarize(prev)
  const out: Insight[] = []

  const inc = pctChange(sc.income, sp.income)
  if (inc !== null && sp.income > 0 && Math.abs(inc) >= 5) {
    out.push({ id: 'income-change', kind: 'fact', tone: inc > 0 ? 'positive' : 'negative', title: `Income ${inc > 0 ? 'up' : 'down'} ${Math.abs(inc).toFixed(0)}%`, detail: `Your income ${inc > 0 ? 'increased' : 'decreased'} ${Math.abs(inc).toFixed(0)}% compared with ${inProgress ? 'the same point in the previous period' : 'the previous period'}.`, basis: `${fmt(sc.income)} vs ${fmt(sp.income)}`, value: inc })
  }
  const exc = pctChange(sc.netExpenses, sp.netExpenses)
  if (exc !== null && sp.netExpenses > 0 && Math.abs(exc) >= 5) {
    out.push({ id: 'expense-change', kind: 'fact', tone: exc > 0 ? 'warning' : 'positive', title: `Spending ${exc > 0 ? 'up' : 'down'} ${Math.abs(exc).toFixed(0)}%`, detail: `You spent ${fmt(Math.abs(sc.netExpenses - sp.netExpenses))} ${exc > 0 ? 'more' : 'less'} than ${inProgress ? 'by this point in the previous period' : 'the previous period'}.`, basis: `${fmt(sc.netExpenses)} vs ${fmt(sp.netExpenses)}`, value: exc })
  }

  // biggest category movers
  const cc = new Map(expensesByCategory(cur).map(x => [x.category, x.total]))
  const pc = new Map(expensesByCategory(prev).map(x => [x.category, x.total]))
  let mover: { cat: string; diff: number; pct: number | null } | null = null
  for (const [cat, total] of cc) {
    const diff = total - (pc.get(cat) || 0)
    if (!mover || diff > mover.diff) mover = { cat, diff, pct: pctChange(total, pc.get(cat) || 0) }
  }
  if (mover && mover.diff > 0 && pc.get(mover.cat)) {
    out.push({ id: 'category-mover', kind: 'fact', tone: 'warning', title: `${categoryLabel(mover.cat)} spending rose`, detail: `You spent ${fmt(mover.diff)} more on ${categoryLabel(mover.cat).toLowerCase()} than the previous period${mover.pct !== null ? ` (${mover.pct > 0 ? '+' : ''}${mover.pct.toFixed(0)}%)` : ''}.`, basis: `${fmt(cc.get(mover.cat)!)} vs ${fmt(pc.get(mover.cat)!)}` })
  }

  if (sp.income > 0 && sc.income > 0 && Math.abs(sc.savingsRate - sp.savingsRate) >= 3) {
    out.push({ id: 'savings-rate', kind: 'fact', tone: sc.savingsRate >= sp.savingsRate ? 'positive' : 'negative', title: `Savings rate ${sc.savingsRate >= sp.savingsRate ? 'improved' : 'dropped'}`, detail: `Your savings rate ${sc.savingsRate >= sp.savingsRate ? 'increased' : 'decreased'} from ${sp.savingsRate.toFixed(0)}% to ${sc.savingsRate.toFixed(0)}%.`, basis: 'Savings rate = (savings + investments) ÷ income' })
  }

  const b = analyzeBehavior(all, current, all)
  if (b.weekendVsWeekdayPct !== null && b.weekendVsWeekdayPct >= 15) {
    out.push({ id: 'weekend', kind: 'fact', tone: 'warning', title: 'Weekend spending is higher', detail: `Your weekend spending is ${b.weekendVsWeekdayPct.toFixed(0)}% higher than weekday spending (per day).`, basis: `${fmt(b.weekendAvgPerDay)}/weekend day vs ${fmt(b.weekdayAvgPerDay)}/weekday` })
  }
  if (b.smallPurchases.count >= 5) {
    out.push({ id: 'small', kind: 'fact', tone: 'neutral', title: 'Small purchases add up', detail: `You have spent ${fmt(b.smallPurchases.total)} on ${b.smallPurchases.count} small purchases (under ${fmt(SMALL_PURCHASE_LIMIT)}) this period.`, basis: `${b.smallPurchases.count} transactions < ${fmt(SMALL_PURCHASE_LIMIT)}` })
  }
  if (b.unexpected.largest) {
    const l = b.unexpected.largest
    out.push({ id: 'unexpected', kind: 'fact', tone: 'neutral', title: 'Largest unexpected expense', detail: `Your largest unexpected expense this period was ${l.description || categoryLabel(l.category)} (${fmt(l.amount)}).`, basis: `${b.unexpected.count} unexpected/emergency expense(s), total ${fmt(b.unexpected.total)}` })
  }

  // average comparison per category (vs trailing 3 months)
  const avgWindowStart = addDays(current.start, -92)
  const hist = all.filter(t => isCounted(t) && t.date >= avgWindowStart && t.date < current.start)
  if (hist.length) {
    const ha = new Map(expensesByCategory(hist).map(x => [x.category, x.total / 3]))
    const food = (cc.get('food_dining') || 0) + (cc.get('groceries') || 0)
    const foodAvg = (ha.get('food_dining') || 0) + (ha.get('groceries') || 0)
    if (foodAvg > 0 && food - foodAvg > foodAvg * 0.15) {
      out.push({ id: 'food-avg', kind: 'fact', tone: 'warning', title: 'Food above your average', detail: `You spent ${fmt(food - foodAvg)} more on food this period than your 3-month average.`, basis: `${fmt(food)} vs avg ${fmt(foodAvg)}` })
    }
  }

  // predictions only when looking at the current month
  if (current.start <= today && today <= current.end && current.start.slice(8) === '01') {
    const f = forecastMonthExpenses(all, rules, today)
    out.push({ id: 'forecast', kind: 'prediction', tone: f.expected > sc.income && sc.income > 0 ? 'warning' : 'neutral', title: 'Month-end spending forecast', detail: `At your current pace you may spend about ${fmt(f.expected)} this month (likely range ${fmt(f.low)}–${fmt(f.high)}).`, basis: `${f.basis} Confidence: ${f.confidence}.` })
    for (const bd of opts.budgets || []) {
      if (!bd.amount) continue
      const elapsed = diffDays(current.start, today) + 1
      const total = diffDays(current.start, current.end) + 1
      const oneOff = cur.filter(t => t.type === 'expense' && t.category === bd.category && (t.kind === 'one_time' || t.kind === 'unexpected' || t.kind === 'emergency')).reduce((a, t) => a + t.amount, 0)
      const projected = forecastCategory(bd.spent, today, undefined, oneOff)
      if (projected > bd.amount * 1.05 && bd.spent < bd.amount) {
        out.push({ id: `budget-${bd.category}`, kind: 'prediction', tone: 'warning', title: `${categoryLabel(bd.category)} budget at risk`, detail: `At your current spending rate, you may exceed your ${categoryLabel(bd.category).toLowerCase()} budget by approximately ${fmt(projected - bd.amount)}.`, basis: `Spent ${fmt(bd.spent)} of ${fmt(bd.amount)} after ${elapsed}/${total} days` })
      }
    }
  }

  // recommendations — always state their basis
  if (sc.income > 0 && sc.savingsRate < 20) {
    out.push({ id: 'rec-save', kind: 'recommendation', tone: 'neutral', title: 'Consider a savings-first transfer', detail: `Moving ${fmt(sc.income * 0.2 - (sc.savings + sc.investments))} more to savings would bring you to a 20% savings rate.`, basis: `Current savings rate ${sc.savingsRate.toFixed(0)}%. 20% is a common general guideline, not personal advice.` })
  }
  const subs = cc.get('subscriptions')
  if (subs) out.push({ id: 'rec-subs', kind: 'recommendation', tone: 'neutral', title: 'Review subscriptions', detail: `You spent ${fmt(subs)} on subscriptions this period. Cancelling unused ones is an easy saving.`, basis: 'Category total: Subscriptions' })

  return out
}
