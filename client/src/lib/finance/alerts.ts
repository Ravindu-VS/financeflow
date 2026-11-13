/**
 * Notification rules. Pure: given the current state, return the alerts that apply right now.
 * Ids are stable per occurrence so a dismissed alert stays dismissed (and a browser
 * notification is shown only once).
 */
import type { RecurringRule } from './types'
import { addDays, diffDays, monthKey } from './dates'

export type AlertSeverity = 'info' | 'warning' | 'danger'
export interface FinanceAlert { id: string; severity: AlertSeverity; title: string; body: string; link: string; kind: 'bill' | 'budget' | 'goal' | 'unusual' | 'safe_to_spend' | 'sync' }

export interface AlertInput {
  today: string
  upcoming: { rule: RecurringRule; date: string }[]
  budgets: { category: string; label: string; amount: number; spent: number; threshold: number }[]
  goals: { id: string; name: string; deadline?: string; pct: number; perMonth: number }[]
  anomalies: { id: string; label: string; amount: number; reason: string }[]
  safeToSpend?: { amount: number; perDay: number } | null
  lowSafeToSpendPerDay?: number
  formatMoney: (n: number) => string
}

export function computeAlerts(i: AlertInput): FinanceAlert[] {
  const out: FinanceAlert[] = []
  const m = monthKey(i.today)
  for (const o of i.upcoming) {
    if (o.rule.type !== 'expense') continue
    const d = diffDays(i.today, o.date)
    if (d < 0 || d > 3) continue
    out.push({
      id: `bill_${o.rule.id}_${o.date}`, kind: 'bill', severity: d === 0 ? 'warning' : 'info', link: '/planning',
      title: d === 0 ? `${o.rule.description || o.rule.category} is due today` : `${o.rule.description || o.rule.category} due in ${d} day${d > 1 ? 's' : ''}`,
      body: `${i.formatMoney(o.rule.amount)} on ${o.date}`,
    })
  }
  for (const b of i.budgets) {
    if (!b.amount) continue
    const pct = b.spent / b.amount * 100
    if (pct >= 100) out.push({ id: `budget_${b.category}_${m}_100`, kind: 'budget', severity: 'danger', link: '/budgets', title: `${b.label} budget exceeded`, body: `${i.formatMoney(b.spent)} of ${i.formatMoney(b.amount)} (${Math.round(pct)}%)` })
    else if (pct >= b.threshold) out.push({ id: `budget_${b.category}_${m}_${b.threshold}`, kind: 'budget', severity: 'warning', link: '/budgets', title: `${b.label} budget at ${Math.round(pct)}%`, body: `${i.formatMoney(b.amount - b.spent)} left this month` })
  }
  for (const g of i.goals) {
    if (!g.deadline || g.pct >= 100) continue
    const d = diffDays(i.today, g.deadline)
    if (d < 0) out.push({ id: `goal_${g.id}_overdue`, kind: 'goal', severity: 'warning', link: '/savings', title: `Goal "${g.name}" passed its deadline`, body: `${g.pct}% reached — set a new date or top it up` })
    else if (d <= 30) out.push({ id: `goal_${g.id}_${g.deadline}`, kind: 'goal', severity: 'info', link: '/savings', title: `Goal "${g.name}" is due in ${d} days`, body: `${g.pct}% reached · needs ${i.formatMoney(g.perMonth)}/month` })
  }
  for (const a of i.anomalies.slice(0, 3)) {
    out.push({ id: `unusual_${a.id}`, kind: 'unusual', severity: 'warning', link: '/transactions', title: `Unusual expense: ${a.label}`, body: `${i.formatMoney(a.amount)} — ${a.reason}` })
  }
  if (i.safeToSpend && i.lowSafeToSpendPerDay != null && i.safeToSpend.perDay < i.lowSafeToSpendPerDay) {
    const neg = i.safeToSpend.amount < 0
    out.push({
      id: `sts_${i.today}`, kind: 'safe_to_spend', severity: neg ? 'danger' : 'warning', link: '/dashboard',
      title: neg ? 'Upcoming commitments exceed your cash' : 'Safe-to-spend is running low',
      body: neg ? `Short by ${i.formatMoney(-i.safeToSpend.amount)} before month end` : `${i.formatMoney(i.safeToSpend.perDay)} per day until month end`,
    })
  }
  const rank = { danger: 0, warning: 1, info: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}

/** Ids older than ~60 days are pruned so the dismissed list stays small. */
export function pruneDismissed(ids: string[], today: string): string[] {
  const cutoff = addDays(today, -60)
  return ids.filter(id => { const d = id.match(/(\d{4}-\d{2}-\d{2})/)?.[1]; return !d || d >= cutoff }).slice(-300)
}
