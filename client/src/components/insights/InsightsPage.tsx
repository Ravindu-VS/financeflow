import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionHeader } from '../ui'
import PeriodSelector from '../finance/PeriodSelector'
import { usePeriodData } from '../../hooks/useFinance'
import { useFinanceStore } from '../../store/financeStore'
import { analyzeBehavior, detectRecurring, subscriptionSpend, formatDateKey, SMALL_PURCHASE_LIMIT, getCategory, type Insight } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'
import ForecastCard from './ForecastCard'

const KIND = {
  fact: { label: 'FACT', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200', help: 'Measured from your recorded transactions' },
  prediction: { label: 'PREDICTION', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', help: 'An estimate — may not happen' },
  recommendation: { label: 'SUGGESTION', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', help: 'General guidance, not personal financial advice' },
}

function InsightCard({ i }: { i: Insight }) {
  const k = KIND[i.kind]
  const tone = i.tone === 'positive' ? 'border-l-green-500' : i.tone === 'negative' ? 'border-l-red-500' : i.tone === 'warning' ? 'border-l-amber-500' : 'border-l-gray-300'
  return (
    <div className={`card p-4 border-l-4 ${tone}`}>
      <div className="flex items-center gap-2 mb-1"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${k.cls}`} title={k.help}>{k.label}</span><h3 className="font-medium text-gray-900 dark:text-white">{i.title}</h3></div>
      <p className="text-sm text-gray-700 dark:text-gray-300">{i.detail}</p>
      <p className="text-xs text-gray-400 mt-1">Basis: {i.basis}</p>
    </div>
  )
}

/** Behavioural analytics + smart insights, all computed from actual transactions. */
export default function InsightsPage() {
  const d = usePeriodData()
  const { transactions, rules, settings } = useFinanceStore()
  const b = useMemo(() => analyzeBehavior(d.txs, d.period, transactions), [d.txs, d.period, transactions])
  const recurring = useMemo(() => detectRecurring(transactions, rules, settings.dismissedSuggestions), [transactions, rules, settings.dismissedSuggestions])
  const subs = useMemo(() => subscriptionSpend(d.txs, d.period.start, d.period.end), [d.txs, d.period])
  const groups = (['fact', 'prediction', 'recommendation'] as const).map(k => ({ k, items: d.insights.filter(i => i.kind === k) }))

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insights</h1><p className="text-sm text-gray-500">Facts, predictions and suggestions — each with the numbers behind it</p></div>
        <PeriodSelector />
      </div>

      {d.forecast && (
        <Card>
          <SectionHeader title="Rest-of-month forecast" subtitle={`Confidence: ${d.forecast.confidence}`} />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-gray-500">Likely low</p><p className="font-semibold tabular-nums">{formatCurrency(d.forecast.low)}</p></div>
            <div><p className="text-xs text-gray-500">Expected spending</p><p className="text-xl font-bold text-blue-600 tabular-nums">{formatCurrency(d.forecast.expected)}</p></div>
            <div><p className="text-xs text-gray-500">Likely high</p><p className="font-semibold tabular-nums">{formatCurrency(d.forecast.high)}</p></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Expected end-of-month net cash flow ≈ <b>{formatCurrency(d.summary.income + d.safeToSpend.expectedIncome - d.forecast.expected)}</b> (income so far + expected recurring income − forecast spending).</p>
          <p className="text-xs text-gray-400 mt-1">{d.forecast.basis} Predictions are estimates, not guarantees.</p>
        </Card>
      )}

      <ForecastCard />

      {groups.map(g => g.items.length > 0 && (
        <div key={g.k} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{g.k === 'fact' ? 'What happened' : g.k === 'prediction' ? 'What may happen' : 'What you could do'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{g.items.map(i => <InsightCard key={i.id} i={i} />)}</div>
        </div>
      ))}
      {!d.insights.length && <Card><p className="text-sm text-gray-500">Not enough data in this period yet. Insights appear as you record transactions.</p></Card>}

      <Card>
        <SectionHeader title="Spending behaviour" subtitle={d.period.label} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-gray-500">Weekday avg / day</p><p className="font-semibold tabular-nums">{formatCurrency(b.weekdayAvgPerDay)}</p></div>
          <div><p className="text-xs text-gray-500">Weekend avg / day</p><p className="font-semibold tabular-nums">{formatCurrency(b.weekendAvgPerDay)}</p>{b.weekendVsWeekdayPct !== null && <p className={`text-xs ${b.weekendVsWeekdayPct > 0 ? 'text-amber-600' : 'text-green-600'}`}>{b.weekendVsWeekdayPct > 0 ? '+' : ''}{b.weekendVsWeekdayPct.toFixed(0)}% vs weekdays</p>}</div>
          <div><p className="text-xs text-gray-500">Small purchases (&lt; {formatCurrency(SMALL_PURCHASE_LIMIT)})</p><p className="font-semibold tabular-nums">{formatCurrency(b.smallPurchases.total)}</p><p className="text-xs text-gray-400">{b.smallPurchases.count} purchases</p></div>
          <div><p className="text-xs text-gray-500">Unexpected / emergency</p><p className="font-semibold tabular-nums">{formatCurrency(b.unexpected.total)}</p><p className="text-xs text-gray-400">{b.unexpected.count} expense(s)</p></div>
          <div><p className="text-xs text-gray-500">Payday spending (3 days)</p>{b.paydaySpending ? <><p className="font-semibold tabular-nums">{formatCurrency(b.paydaySpending.windowTotal)}</p><p className="text-xs text-gray-400">{b.paydaySpending.ratio ? `${b.paydaySpending.ratio.toFixed(1)}× a normal 3 days` : ''}</p></> : <p className="text-gray-400">No salary recorded</p>}</div>
          <div><p className="text-xs text-gray-500">Subscriptions</p><p className="font-semibold tabular-nums">{formatCurrency(subs.total)}</p><p className="text-xs text-gray-400">{subs.items.length} payment(s)</p></div>
          <div><p className="text-xs text-gray-500">Income variability (6 mo)</p><p className="font-semibold">{b.incomeVariability === null ? '—' : `${b.incomeVariability.toFixed(0)}%`}</p><p className="text-xs text-gray-400">{b.incomeVariability === null ? '' : b.incomeVariability < 10 ? 'Stable' : b.incomeVariability < 30 ? 'Moderate' : 'Irregular'}</p></div>
          <div><p className="text-xs text-gray-500">Saving / investing consistency (6 mo)</p><p className="font-semibold">{b.savingsConsistency.toFixed(0)}% / {b.investmentConsistency.toFixed(0)}%</p><p className="text-xs text-gray-400">of months with activity</p></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeader title="Large occasional expenses" />
          {b.largeOccasional.length ? b.largeOccasional.map(t => <div key={t.id} className="flex justify-between text-sm py-1"><span>{formatDateKey(t.date)} · {t.description || getCategory(t.category).label}</span><span className="tabular-nums">{formatCurrency(t.amount)}</span></div>) : <p className="text-sm text-gray-500">None in this period.</p>}
          {b.spikes.length > 0 && <p className="text-xs text-amber-600 mt-2">Spending spikes on: {b.spikes.map(s => `${formatDateKey(s.date)} (${formatCurrency(s.total)})`).join(', ')}</p>}
        </Card>
        <Card>
          <SectionHeader title="Recurring payments detected" action={<Link to="/planning" className="text-sm text-primary-500">Review</Link>} />
          {recurring.length ? recurring.slice(0, 6).map(r => <div key={r.key} className="flex justify-between text-sm py-1"><span>{r.isSubscription ? '📱' : '🔁'} {r.merchant}</span><span className="tabular-nums">~{formatCurrency(r.averageAmount)} {r.frequency}</span></div>) : <p className="text-sm text-gray-500">No new recurring patterns detected.</p>}
        </Card>
      </div>
    </div>
  )
}
