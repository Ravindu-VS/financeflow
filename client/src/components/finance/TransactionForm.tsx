import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Modal } from '../ui'
import { useQuickAdd, type QuickAddMode } from '../../store/quickAddStore'
import { useFinanceStore } from '../../store/financeStore'
import { saveTransaction, updateTransaction, nextDates } from '../../services/transactionActions'
import { recurringService } from '../../services/financeService'
import { scanReceipt } from '../../services/ocr'
import {
  categoriesForType, todayKey, addDays, validateTransaction, findDuplicates, FREQUENCIES, isEssentialCategory,
  formatDateKey, kindForType, makeCustomCategory, registerCustomCategories, CURRENCY_LIST,
  type TransactionType, type Frequency, type ExpenseKind,
} from '../../lib/finance'
import { settingsService } from '../../services/financeService'
import { formatCurrency } from '../../utils/currency'

const MODES: { value: QuickAddMode; label: string; color: string }[] = [
  { value: 'expense', label: 'Expense', color: 'bg-red-500' },
  { value: 'income', label: 'Income', color: 'bg-green-500' },
  { value: 'transfer', label: 'Transfer', color: 'bg-slate-500' },
  { value: 'savings_contribution', label: 'Savings', color: 'bg-emerald-600' },
  { value: 'investment', label: 'Investment', color: 'bg-blue-500' },
  { value: 'bill', label: 'Bill', color: 'bg-amber-500' },
]
const MORE_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'refund', label: 'Refund' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'savings_withdrawal', label: 'Savings withdrawal' },
  { value: 'withdrawal', label: 'Investment withdrawal' },
  { value: 'adjustment', label: 'Balance adjustment' },
]
const PAYMENT_METHODS = ['cash', 'debit_card', 'credit_card', 'bank_transfer', 'ewallet', 'qr', 'other']

async function compressImage(file: File, max = 1024, quality = 0.6): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file)
  })
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

export default function TransactionForm() {
  const { isOpen, mode: initialMode, prefill, editing, close } = useQuickAdd()
  const { accounts, goals, holdings, transactions, settings } = useFinanceStore()
  const [customOpen, setCustomOpen] = useState(false)
  const [customText, setCustomText] = useState('')
  const [mode, setMode] = useState<QuickAddMode>('expense')
  const [f, setF] = useState<any>({})
  const [more, setMore] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [rep, setRep] = useState<{ frequency: Frequency; interval: number; customUnit: 'day' | 'week' | 'month' | 'year'; endDate: string; autoGenerate: boolean; variableAmount: boolean }>({ frequency: 'monthly', interval: 1, customUnit: 'month', endDate: '', autoGenerate: true, variableAmount: false })
  const [dupeAck, setDupeAck] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scan, setScan] = useState<{ busy: boolean; pct: number; note?: string }>({ busy: false, pct: 0 })

  const onReceipt = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) return toast.error('Image too large')
    setScan({ busy: true, pct: 0 })
    try {
      const url = await compressImage(file).catch(() => '')
      if (url && url.length <= 700_000) set('receiptUrl', url)
      const r = await scanReceipt(file, pct => setScan(s => ({ ...s, pct })))
      setF((p: any) => ({
        ...p,
        amount: r.amount != null ? String(r.amount) : p.amount,
        date: r.date || p.date,
        merchant: r.merchant || p.merchant,
        description: p.description || r.merchant || '',
        category: r.category || p.category,
        notes: p.notes || (r.items.length ? r.items.map(i => `${i.name} ${i.amount}`).join('; ').slice(0, 400) : ''),
        source: p.source === 'manual' ? 'ai' : p.source,
      }))
      setMore(true)
      const note = `Read with ${Math.round(r.confidence * 100)}% confidence — please check before saving.${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}`
      setScan({ busy: false, pct: 100, note })
      if (r.amount == null) toast.error('Could not read the total — enter it manually')
      else toast.success('Receipt read — review and save')
    } catch (e: any) {
      setScan({ busy: false, pct: 0, note: navigator.onLine ? 'Could not read this receipt. Try a sharper, well-lit photo.' : 'Receipt scanning needs a connection the first time (to download the OCR model).' })
    }
  }
  const amountRef = useRef<HTMLInputElement>(null)

  const spendable = accounts.filter(a => !a.archived && ['cash', 'bank', 'debit_card', 'ewallet', 'credit_card'].includes(a.type))
  const defaultAccount = (spendable.find(a => a.type === 'bank') || spendable[0] || accounts[0])?.id

  useEffect(() => {
    if (!isOpen) return
    const m: QuickAddMode = editing ? editing.type : initialMode
    setMode(m)
    const base = editing || prefill || {}
    const type: TransactionType = m === 'bill' ? 'expense' : (m as TransactionType)
    setF({
      amount: (base as any).originalAmount ?? base.amount ?? '', date: base.date || todayKey(), time: base.time || '',
      currency: base.currency || settings.baseCurrency || 'LKR', fxRate: base.fxRate ? String(base.fxRate) : '',
      category: base.category || categoriesForType(type)[0]?.id, subcategory: base.subcategory || '',
      description: base.description || '', merchant: base.merchant || '', accountId: base.accountId || defaultAccount,
      toAccountId: base.toAccountId || '', paymentMethod: base.paymentMethod || '', tags: (base.tags || []).join(', '),
      notes: base.notes || '', goalId: base.goalId || '', kind: base.kind || 'one_time', isEssential: base.isEssential,
      receiptUrl: base.receiptUrl || '', holdingId: '', holdingName: '', source: base.source || 'manual', adjustSign: (base.amount ?? 0) < 0 ? '-' : '+',
    })
    setRepeat(m === 'bill'); setMore(!!editing && !!(editing.notes || editing.merchant || editing.tags?.length))
    setRep(r => ({ ...r, autoGenerate: m !== 'bill' }))
    setDupeAck(false)
    setCustomOpen(false); setCustomText('')
    setTimeout(() => amountRef.current?.focus(), 150)
  }, [isOpen, initialMode, prefill, editing])

  const type: TransactionType = mode === 'bill' ? 'expense' : (mode as TransactionType)
  const cats = categoriesForType(type)
  const set = (k: string, v: any) => { setF((p: any) => ({ ...p, [k]: v })); setDupeAck(false) }

  /** "Other → type your own": create (or reuse) a custom category and remember it for next time. */
  const addCustomCategory = async (): Promise<string | null> => {
    const text = customText.trim()
    const kind = kindForType(type)
    if (!text || !kind) return null
    const existing = settings.customCategories || []
    const cat = makeCustomCategory(text, kind, existing)
    if (!existing.some(c => c.id === cat.id) && cat.id.match(/^(cus|inc|inv)_/)) {
      const next = [...existing, cat]
      registerCustomCategories(next) // show immediately, even offline
      settingsService.save({ customCategories: next }).catch(e => toast.error(`Could not save category: ${e.message}`))
    }
    set('category', cat.id)
    setCustomOpen(false); setCustomText('')
    return cat.id
  }

  const typicalMax = useMemo(() => {
    const xs = transactions.filter(t => t.type === type).map(t => t.amount).sort((a, b) => a - b)
    return xs.length >= 10 ? xs[Math.floor(xs.length * 0.9)] : undefined
  }, [transactions, type])

  const baseCur = settings.baseCurrency || 'LKR'
  const foreign = !!f.currency && f.currency !== baseCur
  const draft = () => {
    const amount = Math.abs(parseFloat(String(f.amount).replace(/,/g, '')))
    return {
      type, amount: type === 'adjustment' && f.adjustSign === '-' ? -amount : amount, currency: f.currency || baseCur,
      fxRate: foreign ? (parseFloat(f.fxRate) || undefined) : undefined, date: f.date, time: f.time || undefined,
      category: f.category, subcategory: f.subcategory || undefined, description: f.description.trim() || undefined,
      merchant: f.merchant.trim() || undefined, accountId: f.accountId || undefined,
      toAccountId: ['transfer', 'savings_contribution', 'savings_withdrawal'].includes(type) ? (f.toAccountId || undefined) : undefined,
      paymentMethod: f.paymentMethod || undefined,
      tags: f.tags ? String(f.tags).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
      notes: f.notes.trim() || undefined, goalId: type.startsWith('savings') ? (f.goalId || undefined) : undefined,
      kind: type === 'expense' ? (f.kind as ExpenseKind) : undefined,
      isEssential: type === 'expense' ? (f.isEssential ?? isEssentialCategory(f.category)) : undefined,
      receiptUrl: f.receiptUrl || undefined, status: 'cleared' as const, source: f.source as any,
    }
  }

  const issues = isOpen && f.date ? validateTransaction(draft(), { typicalMax }) : []
  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  const dupes = isOpen && !editing && f.amount ? findDuplicates(draft() as any, transactions) : []

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    // A typed-but-not-added custom category is applied automatically
    if (customOpen && customText.trim()) {
      const id = await addCustomCategory()
      if (id) f.category = id
    }
    if (errors.length) { toast.error(errors[0].message); return }
    if (dupes.length && !dupeAck) { setDupeAck(true); toast('This looks like a duplicate — tap Save again to confirm', { icon: '⚠️' }); return }
    setSaving(true)
    try {
      const d = draft()
      if (editing) {
        await updateTransaction(editing, d)
        toast.success('Transaction updated')
      } else if (mode === 'bill' && !rep.autoGenerate) {
        // A bill is a plan (rule) — it becomes a transaction only when paid.
        await recurringService.save({
          type: 'expense', amount: d.amount, currency: 'LKR', category: d.category, description: d.description || d.merchant || 'Bill',
          merchant: d.merchant, accountId: d.accountId, frequency: rep.frequency, interval: rep.interval, customUnit: rep.customUnit,
          startDate: d.date, endDate: rep.endDate || undefined, autoGenerate: false, reminder: true, isBill: true, isEssential: true,
          variableAmount: rep.variableAmount, active: true,
        })
        toast.success('Bill reminder saved')
      } else {
        const r = await saveTransaction(d, {
          repeat: repeat ? { ...rep, endDate: rep.endDate || undefined, isBill: mode === 'bill' } : undefined,
          newHolding: type === 'investment' && !f.holdingId ? { name: f.holdingName || d.description || 'Investment' } : undefined,
          existingHoldingId: type === 'investment' && f.holdingId ? f.holdingId : undefined,
        })
        toast.success((r as any).ruleOnly ? 'Recurring rule created (first occurrence is in the future)' : r.queued ? 'Saved offline — will sync when online' : 'Saved')
      }
      close()
    } catch (err: any) {
      if (err?.name === 'EditConflictError') { toast.error(err.message, { duration: 6000 }); close(); return }
      console.error(err)
      toast.error(err.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  // wait for the form state to be initialised (avoids uncontrolled→controlled inputs on first open)
  if (!isOpen || f.date === undefined) return null
  const preview = repeat ? nextDates({ frequency: rep.frequency, interval: rep.interval, customUnit: rep.customUnit, startDate: f.date, endDate: rep.endDate || undefined }, 3, f.date) : []

  return (
    <Modal isOpen={isOpen} onClose={close} title={editing ? 'Edit transaction' : 'Add transaction'} size="md">
      <form onSubmit={submit} className="space-y-4">
        {!editing && (
          <div className="flex flex-wrap gap-1.5">
            {MODES.map(m => (
              <button type="button" key={m.value} onClick={() => { setMode(m.value); set('category', categoriesForType(m.value === 'bill' ? 'expense' : m.value as TransactionType)[0]?.id); setRepeat(m.value === 'bill') }}
                className={`px-3 py-2 rounded-lg text-sm font-medium min-h-[40px] ${mode === m.value ? `${m.color} text-white` : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {m.label}
              </button>
            ))}
            <select aria-label="Other types" className="input py-2 w-auto text-sm" value={MORE_TYPES.some(t => t.value === mode) ? mode : ''} onChange={e => { if (e.target.value) { setMode(e.target.value as TransactionType); set('category', categoriesForType(e.target.value as TransactionType)[0]?.id) } }}>
              <option value="">More…</option>
              {MORE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        )}

        {!editing && (type === 'expense' || mode === 'bill' || type === 'refund' || type === 'reimbursement') && (
          <div className="rounded-xl border border-dashed border-primary-300 dark:border-primary-700 p-2.5 flex items-center gap-3">
            <label className={`btn btn-secondary py-2 text-sm cursor-pointer ${scan.busy ? 'opacity-60 pointer-events-none' : ''}`} data-testid="scan-receipt">
              🧾 {scan.busy ? `Reading… ${scan.pct}%` : 'Scan receipt'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onReceipt(e.target.files?.[0])} />
            </label>
            <p className="text-xs text-gray-500 flex-1">{scan.note || 'Take or upload a photo — amount, date, merchant and category are filled in for you to confirm.'}</p>
          </div>
        )}

        <div>
          <label className="label">Amount (Rs.)</label>
          <div className="flex gap-2">
            {type === 'adjustment' && (
              <select className="input w-20" value={f.adjustSign} onChange={e => set('adjustSign', e.target.value)}><option value="+">+</option><option value="-">−</option></select>
            )}
            <input ref={amountRef} inputMode="decimal" autoComplete="off" placeholder="0" className="input text-2xl font-semibold" value={f.amount} onChange={e => set('amount', e.target.value)} />
            <select aria-label="Currency" className="input w-24" value={f.currency} disabled={repeat}
              onChange={e => { const c = e.target.value; setF((p: any) => ({ ...p, currency: c, fxRate: c === baseCur ? '' : String(settings.fxRates?.[c] ?? '') })) }}>
              {CURRENCY_LIST.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          {foreign && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-300">
              <span>1 {f.currency} =</span>
              <input inputMode="decimal" aria-label="Exchange rate" className="input py-1.5 w-28" value={f.fxRate} onChange={e => set('fxRate', e.target.value)} placeholder="rate" />
              <span>{baseCur}</span>
              {parseFloat(f.amount) > 0 && parseFloat(f.fxRate) > 0 && <span className="text-gray-400">≈ {formatCurrency(Math.round(parseFloat(String(f.amount).replace(/,/g, '')) * parseFloat(f.fxRate) * 100) / 100)}</span>}
            </div>
          )}
          {repeat && <p className="text-xs text-gray-400 mt-1">Recurring rules use your base currency ({baseCur}).</p>}
        </div>

        {cats.length > 1 && (
          <div>
            <label className="label">Category</label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {cats.map(c => (
                <button type="button" key={c.id} onClick={() => set('category', c.id)}
                  className={`px-2.5 py-1.5 rounded-full text-sm border ${f.category === c.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
                  {c.icon} {c.label}
                </button>
              ))}
              {kindForType(type) && (
                <button type="button" onClick={() => setCustomOpen(o => !o)}
                  className={`px-2.5 py-1.5 rounded-full text-sm border border-dashed ${customOpen ? 'border-primary-500 text-primary-600' : 'border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400'}`}>
                  ✏️ Other…
                </button>
              )}
            </div>
            {customOpen && (
              <div className="flex gap-2 mt-2">
                <input autoFocus className="input py-2" maxLength={40} placeholder={type === 'income' ? 'Type a category, e.g. Tuition classes' : 'Type a category, e.g. Pet care'}
                  value={customText} onChange={e => setCustomText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory() } }} />
                <button type="button" className="btn btn-primary py-2" disabled={!customText.trim()} onClick={addCustomCategory}>Add</button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{mode === 'bill' ? 'Next due date' : 'Date'}</label>
            <input type="date" className="input" value={f.date} onChange={e => set('date', e.target.value)} />
            {mode !== 'bill' && (
              <div className="flex gap-2 mt-1 text-xs">
                <button type="button" className="text-primary-500" onClick={() => set('date', todayKey())}>Today</button>
                <button type="button" className="text-primary-500" onClick={() => set('date', addDays(todayKey(), -1))}>Yesterday</button>
              </div>
            )}
          </div>
          <div>
            <label className="label">{type === 'transfer' ? 'From account' : type === 'savings_withdrawal' || type === 'withdrawal' ? 'Into account' : 'Account'}</label>
            <select className="input" value={f.accountId || ''} onChange={e => set('accountId', e.target.value)}>
              {accounts.filter(a => !a.archived).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        {(type === 'transfer' || type === 'savings_contribution' || type === 'savings_withdrawal') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{type === 'transfer' ? 'To account' : type === 'savings_withdrawal' ? 'From savings account (optional)' : 'Savings account (optional)'}</label>
              <select className="input" value={f.toAccountId} onChange={e => set('toAccountId', e.target.value)}>
                <option value="">{type === 'transfer' ? 'Select…' : '— none —'}</option>
                {accounts.filter(a => !a.archived && a.id !== f.accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {type !== 'transfer' && (
              <div>
                <label className="label">Goal (optional)</label>
                <select className="input" value={f.goalId} onChange={e => set('goalId', e.target.value)}>
                  <option value="">— none —</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {type === 'investment' && !editing && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Holding</label>
              <select className="input" value={f.holdingId} onChange={e => set('holdingId', e.target.value)}>
                <option value="">+ New holding</option>
                {holdings.filter(h => h.status !== 'sold').map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            {!f.holdingId && <div><label className="label">Holding name</label><input className="input" placeholder="e.g. Commercial Bank FD" value={f.holdingName} onChange={e => set('holdingName', e.target.value)} /></div>}
          </div>
        )}

        <input className="input" placeholder={type === 'income' ? 'Description (e.g. Freelance project)' : 'Description (e.g. Lunch)'} value={f.description} onChange={e => set('description', e.target.value)} />

        {type === 'expense' && (
          <div className="flex flex-wrap gap-1.5">
            {([['one_time', 'One-time'], ['regular', 'Regular'], ['unexpected', 'Unexpected'], ['emergency', 'Emergency']] as const).map(([v, l]) => (
              <button type="button" key={v} onClick={() => set('kind', v)} className={`px-2.5 py-1 rounded-full text-xs border ${f.kind === v ? 'border-primary-500 text-primary-600 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-600 text-gray-500'}`}>{l}</button>
            ))}
            <label className="flex items-center gap-1 text-xs text-gray-500 ml-2">
              <input type="checkbox" checked={f.isEssential ?? isEssentialCategory(f.category)} onChange={e => set('isEssential', e.target.checked)} /> Essential
            </label>
          </div>
        )}

        {!editing && !['transfer', 'adjustment'].includes(type) && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={repeat} disabled={mode === 'bill'} onChange={e => { setRepeat(e.target.checked); if (e.target.checked) setF((p: any) => ({ ...p, currency: baseCur, fxRate: '' })) }} />
              {mode === 'bill' ? 'Repeats' : 'This repeats (create a recurring rule)'}
            </label>
            {repeat && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <select className="input py-2" value={rep.frequency} onChange={e => setRep({ ...rep, frequency: e.target.value as Frequency })}>
                    {FREQUENCIES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                  {rep.frequency === 'custom' ? (
                    <div className="flex gap-1">
                      <input type="number" min={1} className="input py-2 w-16" value={rep.interval} onChange={e => setRep({ ...rep, interval: Number(e.target.value) || 1 })} />
                      <select className="input py-2" value={rep.customUnit} onChange={e => setRep({ ...rep, customUnit: e.target.value as any })}>
                        <option value="day">days</option><option value="week">weeks</option><option value="month">months</option><option value="year">years</option>
                      </select>
                    </div>
                  ) : <input type="date" className="input py-2" title="End date (optional)" value={rep.endDate} onChange={e => setRep({ ...rep, endDate: e.target.value })} />}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked={rep.autoGenerate} onChange={e => setRep({ ...rep, autoGenerate: e.target.checked })} />
                  {mode === 'bill' ? 'Record automatically on each due date (otherwise: reminder only)' : 'Record future occurrences automatically'}
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked={rep.variableAmount} onChange={e => setRep({ ...rep, variableAmount: e.target.checked })} /> Amount varies (estimate)
                </label>
                {preview.length > 0 && <p className="text-xs text-gray-500">Next: {preview.map(d => formatDateKey(d)).join(' · ')}</p>}
              </>
            )}
          </div>
        )}

        <button type="button" className="text-sm text-primary-500" onClick={() => setMore(!more)}>{more ? '− Fewer details' : '+ More details (merchant, time, tags, receipt…)'}</button>
        {more && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder={type === 'income' ? 'Payer' : 'Merchant / payee'} value={f.merchant} onChange={e => set('merchant', e.target.value)} />
              <input type="time" className="input" value={f.time} onChange={e => set('time', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={f.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
                <option value="">Payment method</option>
                {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
              </select>
              <input className="input" placeholder="Subcategory" list="subcats" value={f.subcategory} onChange={e => set('subcategory', e.target.value)} />
              <datalist id="subcats">{(cats.find(c => c.id === f.category)?.subcategories || []).map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <input className="input" placeholder="Tags (comma separated)" value={f.tags} onChange={e => set('tags', e.target.value)} />
            <textarea className="input min-h-[60px]" placeholder="Notes" value={f.notes} onChange={e => set('notes', e.target.value)} />
            <div className="flex items-center gap-3">
              <label className="btn btn-secondary py-2 text-sm cursor-pointer">
                📷 {f.receiptUrl ? 'Replace receipt' : 'Add receipt'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  if (file.size > 15 * 1024 * 1024) return toast.error('Image too large')
                  try {
                    const url = await compressImage(file)
                    if (url.length > 700_000) return toast.error('Receipt image still too large after compression')
                    set('receiptUrl', url)
                  } catch { toast.error('Could not read image') }
                }} />
              </label>
              {f.receiptUrl && <img src={f.receiptUrl} alt="Receipt" className="h-12 w-12 object-cover rounded" />}
            </div>
          </div>
        )}

        {(warnings.length > 0 || dupes.length > 0) && (
          <div className="text-xs rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-2 space-y-0.5">
            {warnings.map(w => <p key={w.message}>⚠️ {w.message}</p>)}
            {dupes.length > 0 && <p>⚠️ Possible duplicate of {dupes[0].description || dupes[0].category} on {formatDateKey(dupes[0].date)} ({formatCurrency(dupes[0].amount)})</p>}
          </div>
        )}

        <div className="flex gap-3 pt-2 sticky bottom-0 bg-white dark:bg-gray-800">
          <button type="button" className="btn btn-secondary flex-1 min-h-[48px]" onClick={close}>Cancel</button>
          <button type="submit" disabled={saving || !!errors.length} className="btn btn-primary flex-1 min-h-[48px] disabled:opacity-50">
            {saving ? 'Saving…' : dupes.length && dupeAck ? 'Save anyway' : editing ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
