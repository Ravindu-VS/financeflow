import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { PencilIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { budgetService } from '../../services/firebaseService'
import { Card, SectionHeader, Modal } from '../ui'
import PeriodSelector from '../finance/PeriodSelector'
import { usePeriodData } from '../../hooks/useFinance'
import { useFinanceStore } from '../../store/financeStore'
import { EXPENSE_CATEGORY_DEFS, getCategory } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'
import { Link } from 'react-router-dom'
import BudgetPlanCard from './BudgetPlanCard'

/**
 * Budgets are PLANS. Spending shown here is actual net spending (refunds deducted) for the
 * selected period; monthly budgets are scaled when you look at a week, quarter or year.
 */
export default function BudgetsPage() {
  const d = usePeriodData()
  const { budgets, refreshModules, settings } = useFinanceStore()
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ category: 'food_dining', amount: '', alertThreshold: '80' })

  const openForm = (id?: string) => {
    const b = budgets.find(x => x.id === id)
    setEditId(id || null)
    setForm(b ? { category: b.category, amount: String(b.amount), alertThreshold: String(b.alertThreshold || 80) } : { category: EXPENSE_CATEGORY_DEFS.find(c => !budgets.some(b => b.category === c.id))?.id || 'other', amount: '', alertThreshold: '80' })
    setModal(true)
  }
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!(amount > 0)) return toast.error('Enter a positive monthly amount')
    if (!editId && budgets.some(b => b.category === form.category)) return toast.error('A budget for this category already exists')
    const data = { category: form.category, name: getCategory(form.category).label, amount, limit: amount, period: 'monthly', alertThreshold: Number(form.alertThreshold) || 80, isActive: true }
    try {
      editId ? await budgetService.update(editId, data) : await budgetService.create(data)
      toast.success('Budget saved'); setModal(false); refreshModules()
    } catch (err: any) { toast.error(err.message) }
  }
  const del = async (id: string) => {
    if (!confirm('Delete this budget?')) return
    await budgetService.delete(id); refreshModules(); toast.success('Budget deleted')
  }

  const total = d.budgetStatus.reduce((a, b) => a + b.amount, 0)
  const spent = d.budgetStatus.reduce((a, b) => a + b.spent, 0)
  const unbudgeted = d.byCategory.filter(c => !budgets.some(b => b.category === c.category))

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
          <p className="text-sm text-gray-500">Budgeted vs actual vs forecast · approach: <Link to="/planning" className="text-primary-500">{settings.budgetMethod.replace('_', ' ')}</Link></p></div>
        <div className="flex gap-2 items-end"><PeriodSelector compact /><button className="btn btn-primary min-h-[44px]" onClick={() => openForm()}>+ Budget</button></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="sm"><p className="text-xs text-gray-500">Budgeted</p><p className="text-lg font-bold tabular-nums">{formatCurrency(total)}</p></Card>
        <Card padding="sm"><p className="text-xs text-gray-500">Spent (budgeted categories)</p><p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(spent)}</p></Card>
        <Card padding="sm"><p className="text-xs text-gray-500">Remaining</p><p className={`text-lg font-bold tabular-nums ${total - spent < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(total - spent)}</p></Card>
        <Card padding="sm"><p className="text-xs text-gray-500">Unbudgeted spending</p><p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(unbudgeted.reduce((a, c) => a + c.total, 0))}</p></Card>
      </div>

      <BudgetPlanCard />

      <Card>
        <SectionHeader title="Category budgets" subtitle={d.period.unit === 'month' ? 'Monthly' : 'Monthly budgets scaled to the selected period'} />
        {d.budgetStatus.length ? (
          <div className="space-y-4">
            {d.budgetStatus.map(b => {
              const doc = budgets.find(x => x.id === b.id)
              const warn = b.pct >= (doc?.alertThreshold || 80)
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{getCategory(b.category).icon} {getCategory(b.category).label} {warn && <ExclamationTriangleIcon className="inline w-4 h-4 text-amber-500" />}</span>
                    <span className="flex items-center gap-1">
                      <span className="text-sm tabular-nums text-gray-500">{formatCurrency(b.spent)} / {formatCurrency(b.amount)}</span>
                      <button aria-label="Edit" className="p-1.5 text-gray-400 hover:text-primary-500" onClick={() => openForm(b.id)}><PencilIcon className="w-4 h-4" /></button>
                      <button aria-label="Delete" className="p-1.5 text-gray-400 hover:text-red-500" onClick={() => del(b.id)}><TrashIcon className="w-4 h-4" /></button>
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1 relative">
                    <div className={`h-full rounded-full ${b.pct >= 100 ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, b.pct)}%` }} />
                    {b.forecast !== undefined && b.amount > 0 && <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500" style={{ left: `${Math.min(100, b.forecast / b.amount * 100)}%` }} title="Forecast" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {b.remaining >= 0 ? `${formatCurrency(b.remaining)} left` : `${formatCurrency(-b.remaining)} over`} · {b.pct}% used
                    {b.forecast !== undefined && <> · <span className={b.forecast > b.amount ? 'text-amber-600' : ''}>forecast {formatCurrency(b.forecast)}{b.forecast > b.amount ? ` (may exceed by ≈${formatCurrency(b.forecast - b.amount)})` : ''}</span></>}
                  </p>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-gray-500">No budgets yet.</p>}
        {unbudgeted.length > 0 && <p className="text-xs text-gray-500 mt-4">Spending without a budget: {unbudgeted.map(c => `${getCategory(c.category).label} ${formatCurrency(c.total)}`).join(' · ')}</p>}
      </Card>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editId ? 'Edit budget' : 'New budget'}>
        <form onSubmit={save} className="space-y-3">
          <select className="input" value={form.category} disabled={!!editId} onChange={e => setForm({ ...form, category: e.target.value })}>{EXPENSE_CATEGORY_DEFS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select>
          <label className="block text-sm">Monthly amount (Rs.)<input inputMode="decimal" className="input mt-1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="block text-sm">Alert at (% used)<input inputMode="numeric" className="input mt-1" value={form.alertThreshold} onChange={e => setForm({ ...form, alertThreshold: e.target.value })} /></label>
          <div className="flex gap-2"><button type="button" className="btn btn-secondary flex-1" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary flex-1">Save</button></div>
        </form>
      </Modal>
    </div>
  )
}
