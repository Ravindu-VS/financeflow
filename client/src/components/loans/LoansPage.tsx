import { useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Card, SectionHeader, Modal } from '../ui'
import { useFinanceStore } from '../../store/financeStore'
import { loanService } from '../../services/financeService'
import { loanStatus, todayKey, formatDateKey, type Loan, type LoanStatus } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'

type Tab = 'borrowed' | 'lent'

/** Loans you took and money you lent: outstanding balances, repayments, due dates, mark as repaid. */
export default function LoansPage() {
  const { loans, loanTxs, accounts } = useFinanceStore()
  const today = todayKey()
  const [tab, setTab] = useState<Tab>('borrowed')
  const [showClosed, setShowClosed] = useState(false)
  const [creating, setCreating] = useState<Tab | null>(null)
  const [repaying, setRepaying] = useState<LoanStatus | null>(null)

  const statuses = useMemo(() => loans.map(l => loanStatus(l, loanTxs, today)).sort((a, b) =>
    (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || (a.loan.dueDate || '9999').localeCompare(b.loan.dueDate || '9999')), [loans, loanTxs, today])
  const totals = useMemo(() => ({
    youOwe: statuses.filter(s => s.loan.direction === 'borrowed').reduce((a, s) => a + s.outstanding, 0),
    owedToYou: statuses.filter(s => s.loan.direction === 'lent').reduce((a, s) => a + s.outstanding, 0),
    overdue: statuses.filter(s => s.overdueDays).length,
  }), [statuses])
  const list = statuses.filter(s => s.loan.direction === tab && (showClosed || s.status === 'active'))

  const close = async (s: LoanStatus, status: Loan['status']) => {
    const verb = status === 'written_off' ? 'Write off' : 'Mark as repaid'
    const msg = s.outstanding > 0
      ? `${verb} with ${formatCurrency(s.outstanding)} still outstanding? No money is recorded — use "Record repayment" if money actually changed hands.`
      : `${verb}?`
    if (!confirm(msg)) return
    try { await loanService.setStatus(s.loan, status); toast.success(status === 'written_off' ? 'Loan written off' : 'Marked as repaid') } catch (e: any) { toast.error(e.message) }
  }
  const reopen = async (s: LoanStatus) => { try { await loanService.setStatus(s.loan, 'active'); toast.success('Loan reopened') } catch (e: any) { toast.error(e.message) } }
  const remove = async (s: LoanStatus) => {
    const linked = loanTxs.filter(t => t.loanId === s.loan.id)
    if (!confirm(`Delete this loan and its ${linked.length} transaction${linked.length === 1 ? '' : 's'}? Account balances will be corrected.`)) return
    try { await loanService.remove(s.loan, linked, accounts); toast.success('Loan deleted') } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loans</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Money you borrowed and money you lent. Loans change your cash, but they are never counted as income or spending.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => setCreating('lent')}>🤝 I lent money</button>
          <button className="btn btn-primary" onClick={() => setCreating('borrowed')}>🏦 I borrowed</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><p className="text-sm text-gray-500 dark:text-gray-400">You owe</p><p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(totals.youOwe)}</p></Card>
        <Card><p className="text-sm text-gray-500 dark:text-gray-400">Owed to you</p><p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(totals.owedToYou)}</p></Card>
        <Card><p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p><p className={`text-2xl font-bold tabular-nums ${totals.overdue ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{totals.overdue}</p></Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1" role="tablist">
            {(['borrowed', 'lent'] as Tab[]).map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                {t === 'borrowed' ? 'I borrowed' : 'I lent'}
              </button>
            ))}
          </div>
          <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2"><input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} /> Show repaid</label>
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
            {tab === 'borrowed' ? 'No loans to repay. Add a bank loan, a lease or money borrowed from someone with “I borrowed”.' : 'Nobody owes you money. Record money you lend with “I lent money”.'}
          </p>
        ) : (
          <ul className="space-y-3" data-testid="loan-list">
            {list.map(s => (
              <li key={s.loan.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{s.loan.direction === 'borrowed' ? `From ${s.loan.counterparty}` : `To ${s.loan.counterparty}`}
                      {s.status === 'repaid' && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Repaid</span>}
                      {s.status === 'written_off' && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">Written off</span>}
                      {s.overdueDays && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Overdue {s.overdueDays} days</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatCurrency(s.principal)} on {formatDateKey(s.loan.startDate)}
                      {s.loan.dueDate ? ` · due ${formatDateKey(s.loan.dueDate)}` : ''}
                      {s.loan.interestRate ? ` · ${s.loan.interestRate}% p.a.` : ''}
                      {s.interest ? ` · interest ${s.loan.direction === 'borrowed' ? 'paid' : 'received'} ${formatCurrency(s.interest)}` : ''}
                      {s.loan.closedDate && s.status !== 'active' ? ` · closed ${formatDateKey(s.loan.closedDate)}` : ''}
                    </p>
                    {s.loan.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.loan.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Outstanding</p>
                    <p className={`text-xl font-bold tabular-nums ${s.outstanding ? (s.loan.direction === 'borrowed' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400') : 'text-gray-900 dark:text-white'}`}>{formatCurrency(s.outstanding)}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"><div className="h-full rounded-full bg-primary-500" style={{ width: `${s.pct}%` }} /></div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatCurrency(s.repaid)} repaid · {s.pct}%</p>
                {s.repayments.length > 0 && (
                  <details className="mt-2"><summary className="text-xs text-primary-600 dark:text-primary-400 cursor-pointer">{s.repayments.length} repayment{s.repayments.length === 1 ? '' : 's'}</summary>
                    <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300 space-y-0.5">{s.repayments.map(t => <li key={t.id} className="flex justify-between"><span>{formatDateKey(t.date)}</span><span className="tabular-nums">{formatCurrency(t.amount)}</span></li>)}</ul>
                  </details>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.status === 'active' ? (<>
                    <button className="btn btn-primary py-1.5 text-sm" onClick={() => setRepaying(s)}>{s.loan.direction === 'borrowed' ? 'Record repayment' : 'Record money received'}</button>
                    <button className="btn btn-secondary py-1.5 text-sm" onClick={() => close(s, 'repaid')}>Mark as repaid</button>
                    {s.loan.direction === 'lent' && <button className="btn btn-secondary py-1.5 text-sm" onClick={() => close(s, 'written_off')}>Write off</button>}
                  </>) : <button className="btn btn-secondary py-1.5 text-sm" onClick={() => reopen(s)}>Reopen</button>}
                  <button className="btn btn-secondary py-1.5 text-sm text-red-600 dark:text-red-400" onClick={() => remove(s)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {creating && <NewLoanModal direction={creating} onClose={() => setCreating(null)} />}
      {repaying && <RepayModal status={repaying} onClose={() => setRepaying(null)} />}
    </div>
  )
}

function NewLoanModal({ direction, onClose }: { direction: Tab; onClose: () => void }) {
  const { accounts, settings } = useFinanceStore()
  const spendable = accounts.filter(a => !a.archived)
  const [f, setF] = useState({ counterparty: '', principal: '', startDate: todayKey(), dueDate: '', interestRate: '', accountId: spendable[0]?.id || '', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await loanService.create({
        direction, counterparty: f.counterparty.trim(), principal: Number(f.principal), currency: settings.baseCurrency || 'LKR',
        startDate: f.startDate, dueDate: f.dueDate || undefined, interestRate: f.interestRate ? Number(f.interestRate) : undefined, notes: f.notes.trim() || undefined,
      }, f.accountId || undefined, accounts)
      toast.success(direction === 'borrowed' ? 'Loan added — the money is in your account' : 'Loan added — the money left your account')
      onClose()
    } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
  }
  return (
    <Modal isOpen onClose={onClose} title={direction === 'borrowed' ? 'I borrowed money' : 'I lent money'}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block"><span className="label">{direction === 'borrowed' ? 'Lender (bank or person)' : 'Borrower'}</span>
          <input className="input" required maxLength={100} value={f.counterparty} onChange={e => set('counterparty', e.target.value)} placeholder={direction === 'borrowed' ? 'e.g. Commercial Bank, Nimal' : 'e.g. Kasun'} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Amount</span><input className="input" required inputMode="decimal" type="number" min="0.01" step="0.01" value={f.principal} onChange={e => set('principal', e.target.value)} /></label>
          <label className="block"><span className="label">Interest % per year (optional)</span><input className="input" type="number" min="0" step="0.01" value={f.interestRate} onChange={e => set('interestRate', e.target.value)} /></label>
          <label className="block"><span className="label">Date</span><input className="input" type="date" required max={todayKey()} value={f.startDate} onChange={e => set('startDate', e.target.value)} /></label>
          <label className="block"><span className="label">Due date (optional)</span><input className="input" type="date" min={f.startDate} value={f.dueDate} onChange={e => set('dueDate', e.target.value)} /></label>
        </div>
        <label className="block"><span className="label">{direction === 'borrowed' ? 'Money received into' : 'Money paid from'}</span>
          <select className="input" value={f.accountId} onChange={e => set('accountId', e.target.value)}>
            {spendable.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            <option value="">Not from an account I track</option>
          </select></label>
        <label className="block"><span className="label">Notes (optional)</span><input className="input" maxLength={300} value={f.notes} onChange={e => set('notes', e.target.value)} /></label>
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add loan'}</button></div>
      </form>
    </Modal>
  )
}

function RepayModal({ status, onClose }: { status: LoanStatus; onClose: () => void }) {
  const { accounts } = useFinanceStore()
  const spendable = accounts.filter(a => !a.archived)
  const borrowed = status.loan.direction === 'borrowed'
  const [f, setF] = useState({ amount: String(status.outstanding), interest: '', date: todayKey(), accountId: spendable[0]?.id || '', note: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await loanService.repay(status.loan, { amount: Number(f.amount), interest: Number(f.interest) || 0, date: f.date, accountId: f.accountId || undefined, note: f.note.trim() || undefined }, status.outstanding, accounts)
      toast.success(r.closed ? 'Fully repaid — loan closed 🎉' : 'Repayment recorded')
      onClose()
    } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
  }
  return (
    <Modal isOpen onClose={onClose} title={borrowed ? `Repay ${status.loan.counterparty}` : `${status.loan.counterparty} paid you back`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">Outstanding: <b className="tabular-nums">{formatCurrency(status.outstanding)}</b></p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Principal amount</span><input className="input" required type="number" min="0.01" step="0.01" max={status.outstanding} value={f.amount} onChange={e => set('amount', e.target.value)} /></label>
          <label className="block"><span className="label">{borrowed ? 'Interest paid (optional)' : 'Interest received (optional)'}</span><input className="input" type="number" min="0" step="0.01" value={f.interest} onChange={e => set('interest', e.target.value)} /></label>
          <label className="block"><span className="label">Date</span><input className="input" type="date" required max={todayKey()} value={f.date} onChange={e => set('date', e.target.value)} /></label>
          <label className="block"><span className="label">{borrowed ? 'Paid from' : 'Received into'}</span>
            <select className="input" value={f.accountId} onChange={e => set('accountId', e.target.value)}>
              {spendable.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              <option value="">Not from an account I track</option>
            </select></label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{borrowed ? 'The principal reduces what you owe. Interest is recorded as an expense.' : 'The principal reduces what you are owed. Interest is recorded as income.'}</p>
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save repayment'}</button></div>
      </form>
    </Modal>
  )
}
