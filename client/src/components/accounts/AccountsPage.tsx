import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Card, SectionHeader, Modal } from '../ui'
import { useFinanceStore, useBalances } from '../../store/financeStore'
import { useQuickAdd } from '../../store/quickAddStore'
import { accountService, snapshotService } from '../../services/financeService'
import { ACCOUNT_TYPES, isLiabilityAccount, netWorth, type Account, type AccountType } from '../../lib/finance'
import { formatCurrency, formatAxisCurrency } from '../../utils/currency'

/** Accounts, balances and net worth (assets − liabilities). */
export default function AccountsPage() {
  const { accounts, holdings } = useFinanceStore()
  const balances = useBalances()
  const { open } = useQuickAdd()
  const [editing, setEditing] = useState<Account | null>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'bank' as AccountType, openingBalance: '', archived: false })
  const [snaps, setSnaps] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { snapshotService.list().then(setSnaps).catch(() => {}) }, [accounts.length])

  const holdingsValue = holdings.filter(h => h.status !== 'sold').reduce((s, h) => s + (Number(h.currentValue) || Number(h.amount) || 0), 0)
  const nw = netWorth(accounts, balances, holdingsValue)
  const prevMonth = snaps[0], prevYear = snaps.find(s => s.month === `${Number(new Date().getFullYear()) - 1}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const trend = [...snaps].reverse().map(s => ({ name: s.month, 'Net worth': s.netWorth })).concat([{ name: 'Now', 'Net worth': nw.netWorth }])

  const openForm = (a?: Account) => {
    setEditing(a || null)
    const liability = a && isLiabilityAccount(a.type)
    setForm(a ? { name: a.name, type: a.type, openingBalance: String(liability ? -a.openingBalance : a.openingBalance), archived: !!a.archived } : { name: '', type: 'bank', openingBalance: '', archived: false })
    setModal(true)
  }
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const raw = Number(form.openingBalance) || 0
    // liabilities: user enters "amount owed" as a positive number → stored negative
    const openingBalance = isLiabilityAccount(form.type) ? -Math.abs(raw) : raw
    try {
      if (editing) await accountService.update(editing, { name: form.name, type: form.type, openingBalance, archived: form.archived })
      else await accountService.create({ name: form.name, type: form.type, currency: 'LKR', openingBalance })
      toast.success('Account saved'); setModal(false)
    } catch (err: any) { toast.error(err.message) }
  }
  const recalc = async () => {
    setBusy(true)
    try { await accountService.recalculate(accounts); toast.success('Balances recalculated from all transactions') } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const groups = ACCOUNT_TYPES.map(t => ({ ...t, items: accounts.filter(a => a.type === t.value) })).filter(g => g.items.length)

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accounts & Net Worth</h1><p className="text-sm text-gray-500">Assets − liabilities</p></div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => open('transfer')}>Transfer</button>
          <button className="btn btn-primary" onClick={() => openForm()}>+ Account</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><p className="text-sm text-gray-500">Net worth</p><p className="text-3xl font-bold tabular-nums">{formatCurrency(nw.netWorth)}</p>
          <p className="text-xs text-gray-500 mt-1">{prevMonth ? <>vs {prevMonth.month}: <span className={nw.netWorth >= prevMonth.netWorth ? 'text-green-600' : 'text-red-600'}>{nw.netWorth >= prevMonth.netWorth ? '+' : ''}{formatCurrency(nw.netWorth - prevMonth.netWorth)}</span></> : 'Month-end snapshots build up automatically'}{prevYear ? <> · vs last year: {formatCurrency(nw.netWorth - prevYear.netWorth)}</> : null}</p></Card>
        <Card><p className="text-sm text-gray-500">Assets</p><p className="text-2xl font-bold text-green-600 tabular-nums">{formatCurrency(nw.assets)}</p><p className="text-xs text-gray-500">incl. investments at current value {formatCurrency(holdingsValue)}</p></Card>
        <Card><p className="text-sm text-gray-500">Liabilities</p><p className="text-2xl font-bold text-red-600 tabular-nums">{formatCurrency(nw.liabilities)}</p><p className="text-xs text-gray-500">credit cards, loans</p></Card>
      </div>

      {trend.length > 1 && (
        <Card><SectionHeader title="Net worth trend" subtitle="From month-end snapshots" />
          <div className="h-56"><ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} tickFormatter={formatAxisCurrency} width={60} /><Tooltip formatter={(v: number) => formatCurrency(v)} /><Line dataKey="Net worth" stroke="#10b981" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
        </Card>
      )}

      <Card>
        <SectionHeader title="Accounts" action={<button disabled={busy} className="text-xs text-gray-500 hover:text-primary-500" onClick={recalc}>{busy ? 'Recalculating…' : 'Recalculate balances'}</button>} />
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.value}>
              <p className="text-xs uppercase font-semibold text-gray-500 mb-1">{g.label}{g.liability ? ' (liability)' : ''}</p>
              {g.items.map(a => (
                <button key={a.id} onClick={() => openForm(a)} className={`w-full flex justify-between py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 ${a.archived ? 'opacity-50' : ''}`}>
                  <span className="text-gray-800 dark:text-gray-200">{a.name}{a.archived ? ' (archived)' : ''}</span>
                  <span className={`tabular-nums font-medium ${(balances[a.id] || 0) < 0 ? 'text-red-600' : ''}`}>{g.liability && (balances[a.id] || 0) < 0 ? `Owed ${formatCurrency(-(balances[a.id] || 0))}` : formatCurrency(balances[a.id] || 0)}</span>
                </button>
              ))}
            </div>
          ))}
          {holdingsValue > 0 && <div><p className="text-xs uppercase font-semibold text-gray-500 mb-1">Investment holdings</p><div className="flex justify-between py-2 px-2"><span>{holdings.filter(h => h.status !== 'sold').length} holdings (Investments page)</span><span className="tabular-nums font-medium">{formatCurrency(holdingsValue)}</span></div></div>}
        </div>
      </Card>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit account' : 'New account'}>
        <form onSubmit={save} className="space-y-3">
          <input required className="input" placeholder="Name (e.g. BOC Savings)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as AccountType })}>{ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          <div>
            <label className="label">{isLiabilityAccount(form.type) ? 'Amount owed at start (Rs.)' : 'Opening balance (Rs.)'}</label>
            <input inputMode="decimal" className="input" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">The balance before the first transaction you record in this app. Changing it shifts the current balance by the same amount.</p>
          </div>
          {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.archived} onChange={e => setForm({ ...form, archived: e.target.checked })} /> Archived (hide from forms & totals; history kept)</label>}
          <div className="flex gap-2"><button type="button" className="btn btn-secondary flex-1" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary flex-1">Save</button></div>
        </form>
      </Modal>
    </div>
  )
}
