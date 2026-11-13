/**
 * Statistical forecasting & anomaly detection (runs on-device, no data leaves the phone).
 *  - Holt's linear exponential smoothing with parameters fitted by grid search (min. SSE),
 *    95% prediction intervals from in-sample one-step residuals (σ·√h).
 *  - Robust anomaly detection: modified z-score (median / MAD) per category.
 * Every output is a PREDICTION and is labelled as such in the UI.
 */
import type { Transaction } from './types'
import { addDays, addMonths, startOfMonth, todayKey, monthKey } from './dates'
import { round2 } from './aggregate'

export interface HoltFit { alpha: number; beta: number; level: number; trend: number; sse: number; residualSd: number; fitted: number[] }
export interface ForecastPoint { step: number; expected: number; low: number; high: number }

function holtRun(y: number[], alpha: number, beta: number) {
  let level = y[0], trend = y.length > 1 ? y[1] - y[0] : 0
  let sse = 0
  const fitted: number[] = [y[0]]
  const res: number[] = []
  for (let t = 1; t < y.length; t++) {
    const pred = level + trend
    fitted.push(pred)
    const e = y[t] - pred
    res.push(e); sse += e * e
    const prevLevel = level
    level = alpha * y[t] + (1 - alpha) * (level + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
  }
  return { level, trend, sse, res, fitted }
}

export function fitHolt(y: number[]): HoltFit {
  if (y.length < 2) return { alpha: 1, beta: 0, level: y[0] || 0, trend: 0, sse: 0, residualSd: 0, fitted: [...y] }
  let best: HoltFit | null = null
  for (let a = 0.1; a <= 0.91; a += 0.1) for (let b = 0; b <= 0.51; b += 0.1) {
    const r = holtRun(y, a, b)
    if (!best || r.sse < best.sse) {
      const n = Math.max(1, r.res.length - 1)
      best = { alpha: round2(a), beta: round2(b), level: r.level, trend: r.trend, sse: r.sse, residualSd: Math.sqrt(r.sse / n), fitted: r.fitted }
    }
  }
  return best!
}

/** Forecast h steps ahead with 95% intervals; negative values are clipped at 0 (spending can't be negative). */
export function holtForecast(y: number[], horizon: number, clipAtZero = true): { fit: HoltFit; points: ForecastPoint[] } {
  const fit = fitHolt(y)
  // damp the trend so a couple of noisy months don't extrapolate forever
  const phi = 0.85
  const points: ForecastPoint[] = []
  let damp = 0
  for (let h = 1; h <= horizon; h++) {
    damp += Math.pow(phi, h)
    let expected = fit.level + damp * fit.trend
    const width = 1.96 * fit.residualSd * Math.sqrt(h)
    let low = expected - width, high = expected + width
    if (clipAtZero) { expected = Math.max(0, expected); low = Math.max(0, low); high = Math.max(0, high) }
    points.push({ step: h, expected: Math.round(expected), low: Math.round(low), high: Math.round(high) })
  }
  return { fit, points }
}

export interface MonthlyForecast {
  history: { month: string; expenses: number; income: number }[]
  expenses: (ForecastPoint & { month: string })[]
  income: (ForecastPoint & { month: string })[]
  method: string
  confidence: 'low' | 'medium' | 'high'
}

/** Net expenses / income per completed month, then Holt forecast for the next `horizon` months. */
export function forecastMonthly(txs: Transaction[], today: string = todayKey(), horizon = 3, lookback = 12): MonthlyForecast | null {
  const thisMonth = startOfMonth(today)
  const first = addMonths(thisMonth, -lookback, 1)
  const buckets = new Map<string, { e: number; i: number }>()
  for (let m = first; m < thisMonth; m = addMonths(m, 1, 1)) buckets.set(monthKey(m), { e: 0, i: 0 })
  for (const t of txs) {
    if (t.status === 'void' || t.date < first || t.date >= thisMonth) continue
    const b = buckets.get(monthKey(t.date)); if (!b) continue
    if (t.type === 'expense') b.e += t.amount
    else if (t.type === 'refund' || t.type === 'reimbursement') b.e -= t.amount
    else if (t.type === 'income') b.i += t.amount
  }
  // drop leading empty months (before the user started tracking)
  const rows = [...buckets.entries()].map(([month, v]) => ({ month, expenses: Math.max(0, round2(v.e)), income: round2(v.i) }))
  while (rows.length && rows[0].expenses === 0 && rows[0].income === 0) rows.shift()
  if (rows.filter(r => r.expenses || r.income).length < 3) return null
  const e = holtForecast(rows.map(r => r.expenses), horizon)
  const i = holtForecast(rows.map(r => r.income), horizon)
  const label = (h: number) => monthKey(addMonths(thisMonth, h - 1, 1))
  const relWidth = e.points[0].expected ? (e.points[0].high - e.points[0].low) / e.points[0].expected : 1
  return {
    history: rows,
    expenses: e.points.map(p => ({ ...p, month: label(p.step) })),
    income: i.points.map(p => ({ ...p, month: label(p.step) })),
    method: `Holt exponential smoothing (α=${e.fit.alpha}, β=${e.fit.beta}, damped) on ${rows.length} months`,
    confidence: rows.length >= 9 && relWidth < 0.5 ? 'high' : rows.length >= 6 && relWidth < 1 ? 'medium' : 'low',
  }
}

export interface Anomaly { transaction: Transaction; score: number; median: number; reason: string }

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/**
 * Unusual expenses in the last `days` days, compared with the same category's history.
 * Modified z-score > 3.5 (Iglewicz & Hoaglin) and at least 2× the category median.
 */
export function detectAnomalies(txs: Transaction[], today: string = todayKey(), days = 30, minHistory = 5): Anomaly[] {
  const recentFrom = addDays(today, -days)
  const byCat = new Map<string, Transaction[]>()
  for (const t of txs) if (t.type === 'expense' && t.status !== 'void') (byCat.get(t.category) || byCat.set(t.category, []).get(t.category)!).push(t)
  const out: Anomaly[] = []
  for (const [, list] of byCat) {
    for (const t of list) {
      if (t.date < recentFrom || t.date > today) continue
      const hist = list.filter(x => x.id !== t.id && x.date < t.date).map(x => x.amount)
      if (hist.length < minHistory) continue
      const med = median(hist)
      const mad = median(hist.map(v => Math.abs(v - med))) || med * 0.1 || 1
      const z = 0.6745 * (t.amount - med) / mad
      if (z > 3.5 && t.amount >= med * 2) {
        out.push({ transaction: t, score: round2(z), median: Math.round(med), reason: `${Math.round(t.amount / med * 10) / 10}× your usual ${t.category.replace(/_/g, ' ')} spend` })
      }
    }
  }
  return out.sort((a, b) => b.score - a.score)
}
