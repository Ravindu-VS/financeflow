import { useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { FunnelIcon, MagnifyingGlassIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { Card, Modal } from '../ui'
import PeriodSelector from '../finance/PeriodSelector'
import TransactionList from '../finance/TransactionList'
import { usePeriodStore } from '../../store/periodStore'
import { useFinanceStore, usePeriodTransactions } from '../../store/financeStore'
import { useQuickAdd } from '../../store/quickAddStore'
import { transactionService } from '../../services/financeService'
import {
  summarize, categoriesForType, toCSV, previewCSVImport, previewJSONImport, TRANSACTION_TYPES, categoryLabel,
  type Transaction, type TransactionType, type ImportPreview,
} from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'

interface Filters { q: string; type: string; category: string; accountId: string; min: string; max: string; paymentMethod: string; tag: string; source: string; recurring: '' | 'yes' | 'no' }
const EMPTY: Filters = { q: '', type: '', category: '', accountId: '', min: '', max: '', paymentMethod: '', tag: '', source: '', recurring: '' }

function download(name: string, text: string, type: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function applyFilters(txs: Transaction[], f: Filters, accountName: (id?: string) => string): Transaction[] {
  const q = f.q.trim().toLowerCase()
  const min = f.min ? Number(f.min) : -Infinity, max = f.max ? Number(f.max) : Infinity
  return txs.filter(t =>
    (!f.type || t.type === f.type) &&
    (!f.category || t.category === f.category) &&
    (!f.accountId || t.accountId === f.accountId || t.toAccountId === f.accountId) &&
    (!f.paymentMethod || t.paymentMethod === f.paymentMethod) &&
    (!f.source || t.source === f.source) &&
    (!f.tag || (t.tags || []).some(x => x.toLowerCase() === f.tag.toLowerCase())) &&
    (f.recurring === '' || (f.recurring === 'yes' ? !!t.recurrenceId : !t.recurrenceId)) &&
    Math.abs(t.amount) >= min && Math.abs(t.amount) <= max &&
    (!q || [t.description, t.merchant, t.notes, categoryLabel(t.category), t.subcategory, accountName(t.accountId), String(t.amount), ...(t.tags || [])]
      .some(v => v && String(v).toLowerCase().includes(q))))
}

interface Props { fixedType?: TransactionType[]; title?: string; subtitle?: string; addMode?: TransactionType }

/** Unified transaction list: search, filters, daily grouping, import & export. Reused by Income/Expenses pages. */
export default function TransactionsPage({ fixedType, title = 'Transactions', subtitle = 'Every financial event, one place', addMode = 'expense' }: Props) {
  const period = usePeriodStore(s => s.period)
  const { txs, loading } = usePeriodTransactions(period)
  const { accounts, transactions } = useFinanceStore()
  const { open } = useQuickAdd()
  const [f, setF] = useState<Filters>(EMPTY)
  const [showFilters, setShowFilters] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importAcc, setImportAcc] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const accName = (id?: string) => accounts.find(a => a.id === id)?.name || ''

  const base = useMemo(() => fixedType ? txs.filter(t => fixedType.includes(t.type)) : txs, [txs, fixedType])
  const list = useMemo(() => applyFilters(base, f, accName), [base, f, accounts])
  const s = summarize(list)
  const catOptions = fixedType ? fixedType.flatMap(t => categoriesForType(t)) : [...categoriesForType('expense'), ...categoriesForType('income'), ...categoriesForType('investment')]
  const active = Object.entries(f).filter(([k, v]) => v && k !== 'q').length

  const onFile = async (file: File) => {
    const text = await file.text()
    const acc = importAcc || accounts.find(a => a.type === 'bank')?.id || accounts[0]?.id
    const p = file.name.toLowerCase().endsWith('.json') ? previewJSONImport(text, transactions, { accountId: acc }) : previewCSVImport(text, transactions, { accountId: acc })
    setPreview(p)
  }
  const doImport = async (includeDupes: boolean) => {
    if (!preview) return
    setImporting(true)
    try {
      const rows = includeDupes ? [...preview.valid, ...preview.duplicates] : preview.valid
      const n = await transactionService.bulkCreate(rows, accounts)
      toast.success(`Imported ${n} transaction(s)`)
      setPreview(null); setImportOpen(false)
    } catch (e: any) { toast.error(e.message) } finally { setImporting(false) }
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <PeriodSelector />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(!fixedType || fixedType.includes('income')) && <Card padding="sm"><p className="text-xs text-gray-500">Income</p><p className="text-lg font-bold text-green-600 tabular-nums">{formatCurrency(s.income)}</p></Card>}
        {(!fixedType || fixedType.includes('expense')) && <Card padding="sm"><p className="text-xs text-gray-500">Expenses{s.refunds ? ' (net of refunds)' : ''}</p><p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(s.netExpenses)}</p></Card>}
        {!fixedType && <Card padding="sm"><p className="text-xs text-gray-500">Net cash flow</p><p className={`text-lg font-bold tabular-nums ${s.netCashFlow >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>{formatCurrency(s.netCashFlow)}</p></Card>}
        {fixedType?.includes('expense') && <Card padding="sm"><p className="text-xs text-gray-500">Essential</p><p className="text-lg font-bold text-orange-500 tabular-nums">{formatCurrency(list.filter(t => t.type === 'expense' && t.isEssential).reduce((a, t) => a + t.amount, 0))}</p></Card>}
        {fixedType?.includes('expense') && <Card padding="sm"><p className="text-xs text-gray-500">One-time / unexpected</p><p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(list.filter(t => t.type === 'expense' && t.kind && t.kind !== 'regular').reduce((a, t) => a + t.amount, 0))}</p></Card>}
        {fixedType?.includes('income') && <Card padding="sm"><p className="text-xs text-gray-500">Recurring</p><p className="text-lg font-bold text-blue-500 tabular-nums">{formatCurrency(list.filter(t => t.type === 'income' && t.recurrenceId).reduce((a, t) => a + t.amount, 0))}</p></Card>}
        {fixedType?.includes('income') && <Card padding="sm"><p className="text-xs text-gray-500">Sources</p><p className="text-lg font-bold text-purple-500">{new Set(list.filter(t => t.type === 'income').map(t => t.category)).size}</p></Card>}
        <Card padding="sm"><p className="text-xs text-gray-500">Transactions</p><p className="text-lg font-bold text-gray-900 dark:text-white">{list.length}</p></Card>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-10 py-2" placeholder="Search merchant, description, amount, tag…" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
          </div>
          <button className="btn btn-secondary py-2" onClick={() => setShowFilters(!showFilters)}><FunnelIcon className="w-4 h-4 mr-1" />Filters{active ? ` (${active})` : ''}</button>
          <button className="btn btn-secondary py-2" onClick={() => download(`transactions-${period.start}_${period.end}.csv`, toCSV(list, accName), 'text/csv')}><ArrowDownTrayIcon className="w-4 h-4 mr-1" />CSV</button>
          <button className="btn btn-secondary py-2" onClick={() => download(`transactions-${period.start}_${period.end}.json`, JSON.stringify({ period, transactions: list }, null, 2), 'application/json')}>JSON</button>
          <button className="btn btn-secondary py-2" onClick={() => setImportOpen(true)}><ArrowUpTrayIcon className="w-4 h-4 mr-1" />Import</button>
          <button className="btn btn-primary py-2" onClick={() => open(addMode)}>+ Add</button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {!fixedType && <select className="input py-2" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}><option value="">All types</option>{TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select>}
            <select className="input py-2" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}><option value="">All categories</option>{catOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            <select className="input py-2" value={f.accountId} onChange={e => setF({ ...f, accountId: e.target.value })}><option value="">All accounts</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <select className="input py-2" value={f.paymentMethod} onChange={e => setF({ ...f, paymentMethod: e.target.value })}><option value="">Any payment method</option>{['cash', 'debit_card', 'credit_card', 'bank_transfer', 'ewallet', 'qr', 'other'].map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}</select>
            <input className="input py-2" inputMode="decimal" placeholder="Min amount" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} />
            <input className="input py-2" inputMode="decimal" placeholder="Max amount" value={f.max} onChange={e => setF({ ...f, max: e.target.value })} />
            <input className="input py-2" placeholder="Tag" value={f.tag} onChange={e => setF({ ...f, tag: e.target.value })} />
            <select className="input py-2" value={f.source} onChange={e => setF({ ...f, source: e.target.value })}><option value="">Any source</option>{['manual', 'voice', 'imported', 'recurring', 'migration', 'api', 'ai'].map(x => <option key={x} value={x}>{x}</option>)}</select>
            <select className="input py-2" value={f.recurring} onChange={e => setF({ ...f, recurring: e.target.value as any })}><option value="">Recurring or not</option><option value="yes">Recurring only</option><option value="no">One-time only</option></select>
            <button className="text-sm text-primary-500" onClick={() => setF({ ...EMPTY, q: f.q })}>Clear filters</button>
          </div>
        )}
      </Card>

      <Card>{loading ? <div className="py-10 text-center text-gray-400">Loading…</div> : <TransactionList txs={list} />}</Card>

      <Modal isOpen={importOpen} onClose={() => { setImportOpen(false); setPreview(null) }} title="Import transactions" size="lg">
        <div className="space-y-3 text-sm">
          <p className="text-gray-500">CSV (this app's export, or a bank statement with Date / Description / Debit / Credit columns) or JSON. Rows are validated and duplicates detected before anything is saved.</p>
          <div className="flex gap-2 items-center">
            <select className="input py-2" value={importAcc} onChange={e => setImportAcc(e.target.value)}><option value="">Import into: default account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>Choose file</button>
            <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
          {preview && (
            <div className="space-y-2">
              <p><b className="text-green-600">{preview.valid.length}</b> ready · <b className="text-amber-600">{preview.duplicates.length}</b> likely duplicates · <b className="text-red-600">{preview.invalid.length}</b> invalid</p>
              {preview.invalid.slice(0, 8).map(r => <p key={r.row} className="text-xs text-red-600">Row {r.row}: {r.errors.join(', ')}</p>)}
              <div className="max-h-48 overflow-y-auto border rounded dark:border-gray-700">
                {preview.valid.slice(0, 50).map((t, i) => <div key={i} className="flex justify-between px-2 py-1 text-xs border-b dark:border-gray-700"><span>{t.date} · {t.type} · {t.description || categoryLabel(t.category)}</span><span>{formatCurrency(t.amount)}</span></div>)}
              </div>
              <div className="flex gap-2">
                <button disabled={importing || !preview.valid.length} className="btn btn-primary" onClick={() => doImport(false)}>{importing ? 'Importing…' : `Import ${preview.valid.length}`}</button>
                {preview.duplicates.length > 0 && <button disabled={importing} className="btn btn-secondary" onClick={() => doImport(true)}>Include duplicates too</button>}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
