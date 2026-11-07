import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import { usePeriodStore } from '../../store/periodStore'
import type { PeriodPreset } from '../../lib/finance'
import { todayKey } from '../../lib/finance'

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
]

/** Highly visible global period selector with ← → navigation. Default: This Month. */
export default function PeriodSelector({ compact = false }: { compact?: boolean }) {
  const { period, setPreset, shift } = usePeriodStore()
  const [custom, setCustom] = useState({ start: period.start, end: period.end })
  const [showCustom, setShowCustom] = useState(false)
  const isCurrent = period.start <= todayKey() && todayKey() <= period.end

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <button aria-label="Previous period" onClick={() => shift(-1)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-primary-500">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div className="px-2 text-center min-w-[150px]">
            <p className={`font-semibold text-gray-900 dark:text-white ${compact ? 'text-sm' : 'text-base'}`}>{period.label}</p>
            {isCurrent && <p className="text-[10px] uppercase tracking-wide text-primary-500 font-semibold -mt-0.5">Current</p>}
          </div>
          <button aria-label="Next period" onClick={() => shift(1)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-primary-500">
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
        <select
          aria-label="Period"
          value={period.preset}
          onChange={e => {
            const v = e.target.value as PeriodPreset
            if (v === 'custom') { setShowCustom(true); setCustom({ start: period.start, end: period.end }) }
            else { setShowCustom(false); setPreset(v) }
          }}
          className="input py-2 w-auto min-h-[44px]"
        >
          {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {!isCurrent && (
          <button onClick={() => { setShowCustom(false); setPreset('this_month') }} className="text-sm text-primary-500 hover:text-primary-600 px-2 min-h-[44px]">
            Back to this month
          </button>
        )}
      </div>
      {showCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
          <input type="date" className="input py-2 w-auto" value={custom.start} onChange={e => setCustom({ ...custom, start: e.target.value })} />
          <span className="text-gray-400">to</span>
          <input type="date" className="input py-2 w-auto" value={custom.end} onChange={e => setCustom({ ...custom, end: e.target.value })} />
          <button className="btn btn-primary py-2" disabled={!custom.start || !custom.end} onClick={() => { setPreset('custom', custom); setShowCustom(false) }}>Apply</button>
        </div>
      )}
    </div>
  )
}
