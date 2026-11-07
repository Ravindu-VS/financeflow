import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Card } from '../ui'
import TransactionList from '../finance/TransactionList'
import { useFinanceStore, usePeriodTransactions } from '../../store/financeStore'
import { makePeriod, shiftPeriod, eachDay, summarize, occurrencesBetween, todayKey, startOfWeek, addDays, legacyToDateKey, formatDateKey, getCategory } from '../../lib/finance'
import { formatCompactCurrency, formatCurrency } from '../../utils/currency'

/** Month calendar: when money enters and leaves — actual transactions plus planned (recurring) items and goal deadlines. */
export default function CalendarPage() {
  const [month, setMonth] = useState(() => makePeriod('this_month'))
  const [selected, setSelected] = useState<string>(todayKey())
  const { txs } = usePeriodTransactions(month)
  const { rules, goals } = useFinanceStore()
  const today = todayKey()

  const byDay = useMemo(() => {
    const m = new Map<string, typeof txs>()
    for (const t of txs) { const a = m.get(t.date) || []; a.push(t); m.set(t.date, a) }
    return m
  }, [txs])
  const planned = useMemo(() => {
    const m = new Map<string, { label: string; amount: number; type: string; bill?: boolean }[]>()
    for (const r of rules) {
      if (!r.active) continue
      for (const d of occurrencesBetween(r, month.start, month.end, 40)) {
        if (r.lastGeneratedDate && d <= r.lastGeneratedDate) continue // already a real transaction
        const a = m.get(d) || []; a.push({ label: r.description, amount: r.amount, type: r.type, bill: r.isBill }); m.set(d, a)
      }
    }
    for (const g of goals) {
      const d = legacyToDateKey(g.targetDate)
      if (d && d >= month.start && d <= month.end) { const a = m.get(d) || []; a.push({ label: `🎯 ${g.name} deadline`, amount: Number(g.targetAmount) || 0, type: 'goal' }); m.set(d, a) }
    }
    return m
  }, [rules, goals, month])

  const gridStart = startOfWeek(month.start)
  const cells = eachDay({ start: gridStart, end: addDays(startOfWeek(month.end), 6) })
  const sel = byDay.get(selected) || []
  const selPlanned = planned.get(selected) || []

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Calendar</h1>
        <div className="flex items-center gap-1">
          <button aria-label="Previous month" className="p-2 min-w-[44px] min-h-[44px]" onClick={() => setMonth(shiftPeriod(month, -1))}><ChevronLeftIcon className="w-5 h-5" /></button>
          <span className="font-semibold min-w-[140px] text-center">{month.label}</span>
          <button aria-label="Next month" className="p-2 min-w-[44px] min-h-[44px]" onClick={() => setMonth(shiftPeriod(month, 1))}><ChevronRightIcon className="w-5 h-5" /></button>
        </div>
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map(k => {
            const inMonth = k >= month.start && k <= month.end
            const s = summarize(byDay.get(k) || [])
            const p = planned.get(k) || []
            return (
              <button key={k} onClick={() => setSelected(k)}
                className={`min-h-[64px] sm:min-h-[84px] rounded-lg p-1 text-left border text-[10px] sm:text-xs ${!inMonth ? 'opacity-30' : ''} ${selected === k ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-100 dark:border-gray-700'} ${k === today ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <div className="font-semibold text-gray-700 dark:text-gray-200">{Number(k.slice(8))}</div>
                {s.income > 0 && <div className="text-green-600 truncate">+{formatCompactCurrency(s.income)}</div>}
                {s.netExpenses > 0 && <div className="text-red-600 truncate">−{formatCompactCurrency(s.netExpenses)}</div>}
                {(s.savings > 0 || s.investments > 0) && <div className="text-blue-600 truncate">↗{formatCompactCurrency(s.savings + s.investments)}</div>}
                {p.length > 0 && <div className="text-amber-600 truncate">⏰ {p.length} planned</div>}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mt-2"><span className="text-green-600">+ income</span><span className="text-red-600">− expenses</span><span className="text-blue-600">↗ saved/invested</span><span className="text-amber-600">⏰ bills & recurring (planned)</span></div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-2">{formatDateKey(selected, { weekday: true, year: true })}</h2>
        {selPlanned.length > 0 && (
          <div className="mb-3 space-y-1">
            <p className="text-xs uppercase text-gray-500 font-semibold">Planned</p>
            {selPlanned.map((p, i) => <div key={i} className="flex justify-between text-sm"><span>{p.bill ? '🧾 ' : ''}{p.label}</span><span className="tabular-nums text-amber-600">{formatCurrency(p.amount)}</span></div>)}
          </div>
        )}
        <TransactionList txs={sel} emptyText="No transactions on this day" />
        {sel.length > 0 && <p className="text-xs text-gray-400 mt-2">Top category: {getCategory([...sel].sort((a, b) => b.amount - a.amount)[0].category).label}</p>}
      </Card>
    </div>
  )
}
