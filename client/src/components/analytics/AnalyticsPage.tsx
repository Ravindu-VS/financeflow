import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts'
import { Card, SectionHeader } from '../ui'
import PeriodSelector from '../finance/PeriodSelector'
import { usePeriodData } from '../../hooks/useFinance'
import { usePeriodStore } from '../../store/periodStore'
import { useFinanceStore } from '../../store/financeStore'
import { monthlySeries, dailySeries, getCategory, parseDateKey, isCounted, expensesByCategory, pctChange, type PeriodPreset } from '../../lib/finance'
import { formatCurrency, formatAxisCurrency } from '../../utils/currency'

const VIEWS: { label: string; preset: PeriodPreset }[] = [
  { label: 'Daily', preset: 'today' }, { label: 'Weekly', preset: 'this_week' }, { label: 'Monthly', preset: 'this_month' }, { label: 'Yearly', preset: 'this_year' },
]

/** Daily / weekly / monthly / yearly analysis of the selected period, with comparison to the previous one. */
export default function AnalyticsPage() {
  const d = usePeriodData()
  const { period, setPreset } = usePeriodStore()
  const snaps = useFinanceStore(s => s.transactions)
  const s = d.summary, p = d.previous
  const months = useMemo(() => monthlySeries(d.txs, d.period), [d.txs, d.period])
  const days = useMemo(() => dailySeries(d.txs, d.period), [d.txs, d.period])
  const multiMonth = months.length > 1

  // weekday pattern (average per weekday in the period)
  const weekday = useMemo(() => {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const tot = new Array(7).fill(0), cnt = new Array(7).fill(0)
    for (const x of days) { const g = parseDateKey(x.date).getDay(); tot[g] += x.expenses; cnt[g]++ }
    return [1, 2, 3, 4, 5, 6, 0].map(i => ({ name: names[i], Average: cnt[i] ? Math.round(tot[i] / cnt[i]) : 0 }))
  }, [days])

  // category trend (top 5 categories by month)
  const catTrend = useMemo(() => {
    const top = d.byCategory.slice(0, 5).map(c => c.category)
    return months.map(m => {
      const row: any = { name: m.month }
      const inM = d.txs.filter(t => isCounted(t) && t.date.startsWith(m.month))
      for (const c of expensesByCategory(inM)) if (top.includes(c.category)) row[getCategory(c.category).label] = c.total
      return row
    })
  }, [months, d.byCategory, d.txs])

  const catCompare = d.byCategory.slice(0, 8).map(c => {
    const prev = expensesByCategory(d.prevTxs).find(x => x.category === c.category)?.total || 0
    return { ...c, prev, change: pctChange(c.total, prev) }
  })

  const nMonths = Math.max(1, months.filter(m => m.count > 0).length || months.length)

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <div className="flex gap-1 mt-2">{VIEWS.map(v => <button key={v.label} onClick={() => setPreset(v.preset)} className={`px-3 py-1.5 rounded-lg text-sm ${period.unit === v.preset.replace('this_', '').replace('today', 'day') ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{v.label}</button>)}</div>
        </div>
        <PeriodSelector />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Income', s.income, p.income, false], ['Expenses', s.netExpenses, p.netExpenses, true],
          ['Saved', s.savings, p.savings, false], ['Invested', s.investments, p.investments, false],
        ].map(([l, v, pv, inv]) => {
          const c = pctChange(v as number, pv as number)
          return (
            <Card key={l as string} padding="sm"><p className="text-xs text-gray-500">{l as string}</p><p className="text-lg font-bold tabular-nums">{formatCurrency(v as number)}</p>
              <p className="text-xs text-gray-500">prev. {formatCurrency(pv as number)}{c !== null && <span className={`ml-1 ${(inv ? c <= 0 : c >= 0) ? 'text-green-600' : 'text-red-600'}`}>{c >= 0 ? '+' : ''}{c.toFixed(0)}%</span>}</p></Card>
          )
        })}
      </div>

      {multiMonth && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card padding="sm"><p className="text-xs text-gray-500">Avg monthly income</p><p className="text-lg font-bold tabular-nums">{formatCurrency(s.income / nMonths)}</p></Card>
          <Card padding="sm"><p className="text-xs text-gray-500">Avg monthly expenses</p><p className="text-lg font-bold tabular-nums">{formatCurrency(s.netExpenses / nMonths)}</p></Card>
          <Card padding="sm"><p className="text-xs text-gray-500">Savings rate</p><p className="text-lg font-bold">{s.savingsRate.toFixed(1)}%</p></Card>
          <Card padding="sm"><p className="text-xs text-gray-500">Net cash flow</p><p className="text-lg font-bold tabular-nums">{formatCurrency(s.netCashFlow)}</p></Card>
        </div>
      )}

      <Card>
        <SectionHeader title={multiMonth ? 'Monthly comparison' : 'Day by day'} subtitle="Income, expenses, savings & investments" />
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={multiMonth ? months.map(m => ({ name: m.month, Income: m.income, Expenses: m.netExpenses, Savings: m.savings, Investments: m.investments })) : days.map(x => ({ name: x.date.slice(8), Income: x.income, Expenses: x.expenses, Savings: x.savings, Investments: x.investments }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} tickFormatter={formatAxisCurrency} width={60} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend />
              <Bar dataKey="Income" fill="#10b981" /><Bar dataKey="Expenses" fill="#ef4444" /><Bar dataKey="Savings" fill="#059669" /><Bar dataKey="Investments" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeader title="Categories vs previous period" />
          {catCompare.length ? catCompare.map(c => (
            <div key={c.category} className="flex justify-between text-sm py-1.5">
              <span>{getCategory(c.category).icon} {getCategory(c.category).label}</span>
              <span className="tabular-nums">{formatCurrency(c.total)} {c.change !== null && <span className={`text-xs ${c.change > 0 ? 'text-red-600' : 'text-green-600'}`}>{c.change > 0 ? '+' : ''}{c.change.toFixed(0)}%</span>}</span>
            </div>
          )) : <p className="text-sm text-gray-500">No expenses in this period.</p>}
        </Card>
        <Card>
          <SectionHeader title="Income sources" />
          {d.byIncome.length ? (
            <div className="h-56"><ResponsiveContainer><PieChart><Pie data={d.byIncome.map(i => ({ name: getCategory(i.category).label, value: i.total, color: getCategory(i.category).color }))} dataKey="value" outerRadius={80} label={(e: any) => e.name}>{d.byIncome.map(i => <Cell key={i.category} fill={getCategory(i.category).color} />)}</Pie><Tooltip formatter={(v: number) => formatCurrency(v)} /></PieChart></ResponsiveContainer></div>
          ) : <p className="text-sm text-gray-500">No income in this period.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeader title="Spending by weekday" subtitle="Average per day in this period" />
          <div className="h-56"><ResponsiveContainer><BarChart data={weekday}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} tickFormatter={formatAxisCurrency} width={55} /><Tooltip formatter={(v: number) => formatCurrency(v)} /><Bar dataKey="Average" fill="#f59e0b" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>
        {multiMonth && (
          <Card>
            <SectionHeader title="Category trends" subtitle="Top 5 categories by month" />
            <div className="h-56"><ResponsiveContainer><LineChart data={catTrend}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} tickFormatter={formatAxisCurrency} width={55} /><Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend />
              {d.byCategory.slice(0, 5).map(c => <Line key={c.category} dataKey={getCategory(c.category).label} stroke={getCategory(c.category).color} dot={false} />)}</LineChart></ResponsiveContainer></div>
          </Card>
        )}
      </div>
      {snaps.length === 0 && <p className="text-sm text-gray-500 text-center">Add transactions to see analytics.</p>}
    </div>
  )
}
