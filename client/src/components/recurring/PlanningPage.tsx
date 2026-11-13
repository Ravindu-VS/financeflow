import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Card, SectionHeader, Modal } from '../ui'
import { useFinanceStore } from '../../store/financeStore'
import { useQuickAdd } from '../../store/quickAddStore'
import { recurringService, settingsService, type PlanningSettings } from '../../services/financeService'
import { acceptRecurringSuggestion, payBill, nextDates } from '../../services/transactionActions'
import {
  frequencyLabel, nextOccurrence, nonMonthlyProvisions, detectRecurring, subscriptionSpend, dataQuality, monthlyEquivalent,
  todayKey, startOfMonth, endOfMonth, addDays, formatDateKey, getCategory, FREQUENCIES, upcomingOccurrences,
  type RecurringRule, type Frequency,
} from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'
import CurrencySettings from './CurrencySettings'

const BUDGET_METHODS: { value: PlanningSettings['budgetMethod']; label: string; help: string }[] = [
  { value: 'category', label: 'Category budgets', help: 'Set a limit per category (Budgets page).' },
  { value: 'monthly', label: 'Single monthly budget', help: 'One total spending limit for the month.' },
  { value: 'flexible', label: 'Flexible', help: 'Track fixed bills; everything else is flexible spending.' },
  { value: 'savings_first', label: 'Savings-first', help: 'Pay yourself first: savings + investment targets come out before spending.' },
  { value: 'zero_based', label: 'Zero-based', help: 'Give every rupee of income a job: budgets + savings = income.' },
]

/** Plans (not facts): recurring rules, bills, non-monthly provisions, detected subscriptions and planning settings. */
export default function PlanningPage() {
  const { rules, transactions, settings } = useFinanceStore()
  const { open } = useQuickAdd()
  const today = todayKey()
  const [s, setS] = useState<PlanningSettings>(settings)
  const [edit, setEdit] = useState<RecurringRule | null>(null)
  useEffect(() => setS(settings), [settings])

  const provisions = useMemo(() => nonMonthlyProvisions(rules, today), [rules, today])
  const suggestions = useMemo(() => detectRecurring(transactions, rules, settings.dismissedSuggestions), [transactions, rules, settings.dismissedSuggestions])
  const subs = useMemo(() => subscriptionSpend(transactions, startOfMonth(today), endOfMonth(today)), [transactions, today])
  const quality = useMemo(() => dataQuality(transactions, today), [transactions, today])
  const upcoming = useMemo(() => upcomingOccurrences(rules, today, 30).filter(o => !o.rule.lastGeneratedDate || o.date > o.rule.lastGeneratedDate), [rules, today])
  const monthlyFixed = rules.filter(r => r.active && r.type === 'expense').reduce((a, r) => a + monthlyEquivalent(r), 0)
  const monthlyIncome = rules.filter(r => r.active && r.type === 'income').reduce((a, r) => a + monthlyEquivalent(r), 0)

  const saveSettings = async () => { try { await settingsService.save(s); toast.success('Planning settings saved') } catch (e: any) { toast.error(e.message) } }
  const toggle = (r: RecurringRule, patch: Partial<RecurringRule>) => recurringService.save({ ...r, ...patch }).then(() => toast.success('Rule updated (past transactions unchanged)')).catch(e => toast.error(e.message))

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planning</h1><p className="text-sm text-gray-500">Recurring rules, bills and provisions are plans — they never change your actual history.</p></div>
        <div className="flex gap-2"><button className="btn btn-secondary" onClick={() => open('bill')}>+ Bill</button><button className="btn btn-primary" onClick={() => open('income', {})}>+ Recurring income</button></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><p className="text-sm text-gray-500">Expected recurring income / month</p><p className="text-2xl font-bold text-green-600 tabular-nums">{formatCurrency(monthlyIncome)}</p></Card>
        <Card><p className="text-sm text-gray-500">Recurring expenses / month (incl. provisions)</p><p className="text-2xl font-bold text-red-600 tabular-nums">{formatCurrency(monthlyFixed)}</p></Card>
        <Card><p className="text-sm text-gray-500">Subscriptions this month</p><p className="text-2xl font-bold text-purple-600 tabular-nums">{formatCurrency(subs.total)}</p><p className="text-xs text-gray-400">{subs.items.length} payment(s)</p></Card>
      </div>

      <Card>
        <SectionHeader title="Recurring rules" subtitle="Editing a rule only affects future occurrences" />
        {rules.length ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {[...rules].sort((a, b) => Number(b.active) - Number(a.active) || a.description.localeCompare(b.description)).map(r => {
              const next = nextOccurrence(r, today)
              return (
                <div key={r.id} className={`py-3 flex flex-wrap items-center gap-3 ${r.active ? '' : 'opacity-50'}`}>
                  <span className="text-xl">{getCategory(r.category).icon}</span>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-medium text-gray-900 dark:text-white">{r.description || getCategory(r.category).label} {r.isBill && <span className="text-[10px] px-1.5 rounded bg-amber-100 text-amber-700">BILL</span>}</p>
                    <p className="text-xs text-gray-500">{r.type} · {frequencyLabel(r)} · {formatCurrency(r.amount)}{r.variableAmount ? ' (est.)' : ''} · next {next ? formatDateKey(next, { year: true }) : '—'}{r.endDate ? ` · ends ${formatDateKey(r.endDate, { year: true })}` : ''}</p>
                  </div>
                  <label className="text-xs flex items-center gap-1" title="Starts recording from today; missed past occurrences are not back-filled"><input type="checkbox" checked={r.autoGenerate} onChange={e => {
                    const yesterday = addDays(today, -1)
                    toggle(r, { autoGenerate: e.target.checked, lastGeneratedDate: e.target.checked && (!r.lastGeneratedDate || r.lastGeneratedDate < yesterday) ? (r.startDate > yesterday ? undefined : yesterday) : r.lastGeneratedDate })
                  }} />Auto-record</label>
                  {next && <button className="text-xs text-gray-500 hover:text-primary-500" onClick={() => recurringService.skip(r, next).then(() => toast.success(`Skipped ${formatDateKey(next)}`))}>Skip next</button>}
                  <button className="text-xs text-gray-500 hover:text-primary-500" onClick={() => toggle(r, { active: !r.active })}>{r.active ? 'Pause' : 'Resume'}</button>
                  <button className="text-xs text-primary-600" onClick={() => setEdit(r)}>Edit</button>
                  <button className="text-xs text-red-500" onClick={() => confirm('Delete this rule? Transactions it already created are kept.') && recurringService.remove(r.id).then(() => toast.success('Rule deleted; history kept'))}>Delete</button>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-gray-500">No recurring rules. Tick “This repeats” when adding a transaction, or add a bill.</p>}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeader title="Upcoming (30 days)" />
          {upcoming.length ? upcoming.slice(0, 15).map(u => (
            <div key={u.rule.id + u.date} className="flex justify-between items-center py-1.5 text-sm">
              <span>{formatDateKey(u.date, { weekday: true })} · {u.rule.description}</span>
              <span className="flex items-center gap-2"><span className={`tabular-nums ${u.rule.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(u.rule.amount)}</span>
                {!u.rule.autoGenerate && u.date <= today && <button className="text-xs border rounded px-2 py-0.5 text-primary-600" onClick={() => payBill(u.rule, u.date).then(() => toast.success('Recorded'))}>{u.rule.type === 'income' ? 'Received' : 'Paid'}</button>}
              </span>
            </div>
          )) : <p className="text-sm text-gray-500">Nothing scheduled.</p>}
        </Card>

        <Card>
          <SectionHeader title="Non-monthly expense planning" subtitle="Set aside monthly for annual/irregular costs — not recorded as expenses" />
          {provisions.length ? (
            <>
              {provisions.map(p => (
                <div key={p.rule.id} className="flex justify-between py-1.5 text-sm">
                  <span>{p.rule.description} <span className="text-xs text-gray-400">{formatCurrency(p.rule.amount)} {frequencyLabel(p.rule).toLowerCase()} · due {p.nextDue ? formatDateKey(p.nextDue, { year: true }) : '—'}</span></span>
                  <span className="tabular-nums font-medium">{formatCurrency(p.monthlyProvision)}/mo</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t dark:border-gray-700 text-sm font-semibold"><span>Recommended monthly provision</span><span className="tabular-nums">{formatCurrency(provisions.reduce((a, p) => a + p.monthlyProvision, 0))}</span></div>
            </>
          ) : <p className="text-sm text-gray-500">Add an annual or 6-monthly bill (e.g. insurance Rs. 60,000/year → Rs. 5,000/month provision).</p>}
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card>
          <SectionHeader title="Looks recurring" subtitle="Detected from your history — nothing changes unless you accept" />
          {suggestions.map(sg => (
            <div key={sg.key} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0 dark:border-gray-700 text-sm">
              <span>{sg.isSubscription ? '📱 ' : '🔁 '}<b>{sg.merchant}</b> · ~{formatCurrency(sg.averageAmount)} {FREQUENCIES.find(f => f.value === sg.frequency)?.label.toLowerCase()} · {sg.occurrences} times, last {formatDateKey(sg.lastDate)}</span>
              <span className="flex gap-2">
                <button className="btn btn-primary py-1 text-xs" onClick={() => acceptRecurringSuggestion(sg).then(() => toast.success('Marked as recurring'))}>Mark as recurring</button>
                <button className="btn btn-secondary py-1 text-xs" onClick={() => settingsService.save({ dismissedSuggestions: [...settings.dismissedSuggestions, sg.key] })}>Not recurring</button>
              </span>
            </div>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeader title="Planning settings" subtitle="Used by Safe-to-Spend and budget views" />
          <div className="space-y-3 text-sm">
            <label className="block">Emergency reserve to keep untouched (Rs.)<input inputMode="decimal" className="input mt-1" value={s.emergencyReserve || ''} onChange={e => setS({ ...s, emergencyReserve: Number(e.target.value) || 0 })} /></label>
            <label className="block">Monthly savings target (Rs.)<input inputMode="decimal" className="input mt-1" value={s.monthlySavingsTarget || ''} onChange={e => setS({ ...s, monthlySavingsTarget: Number(e.target.value) || 0 })} /></label>
            <label className="block">Monthly investment target (Rs.)<input inputMode="decimal" className="input mt-1" value={s.monthlyInvestmentTarget || ''} onChange={e => setS({ ...s, monthlyInvestmentTarget: Number(e.target.value) || 0 })} /></label>
            <label className="block">Budgeting approach
              <select className="input mt-1" value={s.budgetMethod} onChange={e => setS({ ...s, budgetMethod: e.target.value as any })}>{BUDGET_METHODS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}</select>
              <span className="text-xs text-gray-400">{BUDGET_METHODS.find(b => b.value === s.budgetMethod)?.help}</span>
            </label>
            {s.budgetMethod === 'monthly' && <label className="block">Monthly spending limit (Rs.)<input inputMode="decimal" className="input mt-1" value={s.monthlyBudget || ''} onChange={e => setS({ ...s, monthlyBudget: Number(e.target.value) || 0 })} /></label>}
            {(s.budgetMethod === 'zero_based' || s.budgetMethod === 'savings_first') && monthlyIncome > 0 && (
              <p className="text-xs text-gray-500">Expected income {formatCurrency(monthlyIncome)} − savings {formatCurrency(s.monthlySavingsTarget)} − investments {formatCurrency(s.monthlyInvestmentTarget)} − recurring {formatCurrency(monthlyFixed)} = <b>{formatCurrency(monthlyIncome - s.monthlySavingsTarget - s.monthlyInvestmentTarget - monthlyFixed)}</b> left to assign.</p>
            )}
            <button className="btn btn-primary" onClick={saveSettings}>Save settings</button>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Data quality" subtitle="Last 13 months" />
          <ul className="text-sm space-y-1">
            <li>{quality.duplicateGroups.length ? '⚠️' : '✓'} {quality.duplicateGroups.length} possible duplicate group(s)</li>
            <li>{quality.missingCategory.length ? '⚠️' : '✓'} {quality.missingCategory.length} transaction(s) missing a category</li>
            <li>{quality.invalid.length ? '⚠️' : '✓'} {quality.invalid.length} invalid transaction(s)</li>
            <li>{quality.suspicious.length ? '⚠️' : '✓'} {quality.suspicious.length} unusually large expense(s)</li>
          </ul>
          {quality.duplicateGroups.slice(0, 5).map((g, i) => <p key={i} className="text-xs text-gray-500 mt-1">{formatDateKey(g[0].date)} · {g[0].description || g[0].category} · {formatCurrency(g[0].amount)} × {g.length}</p>)}
        </Card>
      </div>

      <CurrencySettings />

      {edit && <RuleEditor rule={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function RuleEditor({ rule, onClose }: { rule: RecurringRule; onClose: () => void }) {
  const [r, setR] = useState<RecurringRule>(rule)
  const save = async () => {
    try { await recurringService.save(r); toast.success('Future occurrences updated; past transactions unchanged'); onClose() } catch (e: any) { toast.error(e.message) }
  }
  return (
    <Modal isOpen onClose={onClose} title="Edit recurring rule">
      <div className="space-y-3 text-sm">
        <input className="input" value={r.description} onChange={e => setR({ ...r, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <label>Amount<input inputMode="decimal" className="input mt-1" value={r.amount} onChange={e => setR({ ...r, amount: Number(e.target.value) || 0 })} /></label>
          <label>Frequency<select className="input mt-1" value={r.frequency} onChange={e => setR({ ...r, frequency: e.target.value as Frequency })}>{FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
          <label>End date<input type="date" className="input mt-1" value={r.endDate || ''} onChange={e => setR({ ...r, endDate: e.target.value || undefined })} /></label>
          <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={!!r.isBill} onChange={e => setR({ ...r, isBill: e.target.checked })} />Essential bill</label>
        </div>
        <p className="text-xs text-gray-500">Next: {nextDates(r, 3).map(d => formatDateKey(d)).join(' · ') || '—'}</p>
        <p className="text-xs text-amber-600">Changes apply to occurrences generated from now on. Already-recorded transactions are historical records and stay as they are (edit them individually if needed).</p>
        <div className="flex gap-2"><button className="btn btn-secondary flex-1" onClick={onClose}>Cancel</button><button className="btn btn-primary flex-1" onClick={save}>Save</button></div>
      </div>
    </Modal>
  )
}
