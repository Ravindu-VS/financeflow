import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { usePeriodData } from '../../hooks/useFinance'
import { useFinanceStore } from '../../store/financeStore'
import { settingsService } from '../../services/financeService'
import { computeAlerts, detectAnomalies, getCategory, makePeriod, pruneDismissed, todayKey, type FinanceAlert } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'

const NOTIFIED_KEY = 'ff_notified_alerts'
const tone: Record<FinanceAlert['severity'], string> = {
  danger: 'border-l-red-500 bg-red-50/60 dark:bg-red-900/10',
  warning: 'border-l-amber-500 bg-amber-50/60 dark:bg-amber-900/10',
  info: 'border-l-sky-500 bg-sky-50/60 dark:bg-sky-900/10',
}

/** Bell + panel: bills due, budget thresholds, goal deadlines, unusual expenses, low safe-to-spend. */
export default function NotificationCenter() {
  const today = todayKey()
  const period = useMemo(() => makePeriod('this_month', today), [today])
  const d = usePeriodData(period)
  const { budgets, transactions, settings } = useFinanceStore()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const alerts = useMemo(() => {
    const all = computeAlerts({
      today, formatMoney: formatCurrency,
      upcoming: d.upcoming,
      budgets: d.budgetStatus.map(b => ({ category: b.category, label: getCategory(b.category).label, amount: b.amount, spent: b.spent, threshold: Number(budgets.find(x => x.id === b.id)?.alertThreshold) || 80 })),
      goals: d.goalProgress.map(g => ({ id: g.id, name: g.name, deadline: g.deadline, pct: g.pct, perMonth: g.perMonth })),
      anomalies: detectAnomalies(transactions, today, 7).map(a => ({ id: a.transaction.id, label: a.transaction.description || a.transaction.merchant || getCategory(a.transaction.category).label, amount: a.transaction.amount, reason: a.reason })),
      safeToSpend: d.safeToSpend ? { amount: d.safeToSpend.safeToSpend, perDay: d.safeToSpend.dailyLimit } : null,
      lowSafeToSpendPerDay: 500,
    })
    const dismissed = new Set(settings.dismissedAlerts || [])
    return all.filter(a => !dismissed.has(a.id))
  }, [d, budgets, transactions, settings.dismissedAlerts, today])

  // Browser notifications (opt-in), each alert at most once per device
  useEffect(() => {
    if (!settings.notificationsEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    let seen: string[] = []
    try { seen = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]') } catch { /* ignore */ }
    const fresh = alerts.filter(a => a.severity !== 'info' && !seen.includes(a.id)).slice(0, 3)
    for (const a of fresh) {
      try { new Notification(a.title, { body: a.body, tag: a.id, icon: `${import.meta.env.BASE_URL}pwa-192x192.svg` }) } catch { /* some mobile browsers need a SW */ }
    }
    if (fresh.length) try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...seen, ...fresh.map(a => a.id)].slice(-300))) } catch { /* ignore */ }
  }, [alerts, settings.notificationsEnabled])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const dismiss = (ids: string[]) => settingsService.save({ dismissedAlerts: pruneDismissed([...(settings.dismissedAlerts || []), ...ids], today) }).catch(() => undefined)
  const urgent = alerts.filter(a => a.severity !== 'info').length

  return (
    <div className="relative" ref={box}>
      <button aria-label={`Notifications (${alerts.length})`} data-testid="notifications" onClick={() => setOpen(o => !o)}
        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative">
        <BellIcon className="w-5 h-5" />
        {alerts.length > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${urgent ? 'bg-red-500' : 'bg-sky-500'}`}>{alerts.length > 9 ? '9+' : alerts.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] max-h-[70vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
            <p className="font-semibold text-gray-900 dark:text-white">Notifications</p>
            {alerts.length > 0 && <button className="text-xs text-primary-500" onClick={() => dismiss(alerts.map(a => a.id))}>Clear all</button>}
          </div>
          {alerts.length === 0 ? (
            <p className="p-6 text-sm text-center text-gray-500">You're all caught up ✨<br /><span className="text-xs">Bills due, budget limits, goal deadlines and unusual spending show up here.</span></p>
          ) : (
            <ul className="p-2 space-y-1.5">
              {alerts.map(a => (
                <li key={a.id} className={`border-l-4 rounded-lg p-3 flex gap-2 ${tone[a.severity]}`}>
                  <Link to={a.link} onClick={() => setOpen(false)} className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{a.title}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{a.body}</p>
                  </Link>
                  <button aria-label="Dismiss" className="p-1 text-gray-400 hover:text-gray-600 self-start" onClick={() => dismiss([a.id])}><XMarkIcon className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
          {!settings.notificationsEnabled && typeof Notification !== 'undefined' && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <button className="text-xs text-primary-500" onClick={async () => {
                const p = await Notification.requestPermission()
                if (p === 'granted') settingsService.save({ notificationsEnabled: true }).catch(() => undefined)
              }}>🔔 Turn on device notifications</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
