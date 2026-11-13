import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { Card, SectionHeader } from '../ui'
import { useFinanceStore } from '../../store/financeStore'
import { forecastMonthly, detectAnomalies, getCategory, monthLabel, todayKey, formatDateKey } from '../../lib/finance'
import { formatCurrency, formatAxisCurrency } from '../../utils/currency'

/** PREDICTION: statistical forecast of the next months + unusual expenses (on-device). */
export default function ForecastCard() {
  const transactions = useFinanceStore(s => s.transactions)
  const today = todayKey()
  const f = useMemo(() => forecastMonthly(transactions, today, 3), [transactions, today])
  const anomalies = useMemo(() => detectAnomalies(transactions, today, 30).slice(0, 5), [transactions, today])

  const data = f ? [
    ...f.history.map(h => ({ m: monthLabel(h.month + '-01').slice(0, 3), Actual: h.expenses, Income: h.income })),
    ...f.expenses.map((p, i) => ({ m: monthLabel(p.month + '-01').slice(0, 3) + '*', Forecast: p.expected, range: [p.low, p.high], IncomeForecast: f.income[i].expected })),
  ] : []

  return (
    <Card>
      <SectionHeader title="🔮 Forecast — next 3 months" subtitle={f ? `PREDICTION · ${f.method} · confidence ${f.confidence}` : 'PREDICTION'} />
      {f ? (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} width={56} />
                <Tooltip formatter={(v: any) => Array.isArray(v) ? `${formatCurrency(v[0])} – ${formatCurrency(v[1])}` : formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Actual" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Area dataKey="range" name="95% range" fill="#f59e0b" fillOpacity={0.18} stroke="none" />
                <Bar dataKey="Forecast" name="Forecast expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Line dataKey="Income" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line dataKey="IncomeForecast" name="Income forecast" stroke="#10b981" strokeDasharray="5 4" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {f.expenses.map((p, i) => (
              <div key={p.month} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-2.5">
                <p className="text-xs text-gray-500">{monthLabel(p.month + '-01')}</p>
                <p className="font-semibold tabular-nums">{formatCurrency(p.expected)}</p>
                <p className="text-[11px] text-gray-500 tabular-nums">{formatCurrency(p.low)} – {formatCurrency(p.high)}</p>
                <p className={`text-[11px] tabular-nums ${f.income[i].expected - p.expected >= 0 ? 'text-green-600' : 'text-red-600'}`}>net ≈ {formatCurrency(f.income[i].expected - p.expected)}</p>
              </div>
            ))}
          </div>
        </>
      ) : <p className="text-sm text-gray-500">Needs at least 3 months of recorded transactions to forecast.</p>}

      <div className="mt-5">
        <p className="font-medium text-gray-900 dark:text-white mb-1">Unusual expenses (last 30 days)</p>
        {anomalies.length ? anomalies.map(a => (
          <div key={a.transaction.id} className="flex justify-between gap-2 text-sm py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <span className="min-w-0 truncate">{getCategory(a.transaction.category).icon} {a.transaction.description || a.transaction.merchant || getCategory(a.transaction.category).label} <span className="text-xs text-gray-500">· {formatDateKey(a.transaction.date)} · {a.reason}</span></span>
            <span className="tabular-nums font-medium text-amber-600">{formatCurrency(a.transaction.amount)}</span>
          </div>
        )) : <p className="text-sm text-gray-500">Nothing unusual — every recent expense is within your normal range for its category.</p>}
      </div>
    </Card>
  )
}
