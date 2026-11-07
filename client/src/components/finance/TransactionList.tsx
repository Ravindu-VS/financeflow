import { toast } from 'react-hot-toast'
import { PencilIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import type { Transaction } from '../../lib/finance'
import { groupByDay, getCategory, formatDateKey } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'
import { useQuickAdd } from '../../store/quickAddStore'
import { useFinanceStore } from '../../store/financeStore'
import { deleteTransaction } from '../../services/transactionActions'

export const TYPE_META: Record<string, { label: string; sign: '+' | '-' | '↔' | ''; cls: string }> = {
  income: { label: 'Income', sign: '+', cls: 'text-green-600 dark:text-green-400' },
  expense: { label: 'Expense', sign: '-', cls: 'text-red-600 dark:text-red-400' },
  refund: { label: 'Refund', sign: '+', cls: 'text-teal-600 dark:text-teal-400' },
  reimbursement: { label: 'Reimbursement', sign: '+', cls: 'text-teal-600 dark:text-teal-400' },
  transfer: { label: 'Transfer', sign: '↔', cls: 'text-slate-500' },
  savings_contribution: { label: 'Saved', sign: '', cls: 'text-emerald-600 dark:text-emerald-400' },
  savings_withdrawal: { label: 'Savings withdrawal', sign: '', cls: 'text-amber-600' },
  investment: { label: 'Invested', sign: '', cls: 'text-blue-600 dark:text-blue-400' },
  withdrawal: { label: 'Investment withdrawal', sign: '', cls: 'text-amber-600' },
  adjustment: { label: 'Adjustment', sign: '', cls: 'text-gray-500' },
}

export function TransactionRow({ t, compact }: { t: Transaction; compact?: boolean }) {
  const { edit } = useQuickAdd()
  const accounts = useFinanceStore(s => s.accounts)
  const c = getCategory(t.category)
  const m = TYPE_META[t.type] || TYPE_META.expense
  const acc = accounts.find(a => a.id === t.accountId)?.name
  const toAcc = accounts.find(a => a.id === t.toAccountId)?.name
  const del = async () => {
    if (!confirm('Delete this transaction? This cannot be undone.')) return
    try { await deleteTransaction(t); toast.success('Deleted') } catch (e: any) { toast.error(e.message || 'Delete failed') }
  }
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg" style={{ background: `${c.color}22` }}>{c.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {t.description || t.merchant || c.label}
          {t.recurrenceId && <ArrowPathIcon title="Recurring" className="inline w-3.5 h-3.5 ml-1 text-blue-400" />}
          {t.kind === 'unexpected' || t.kind === 'emergency' ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{t.kind}</span> : null}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {m.label !== 'Expense' && m.label !== 'Income' ? `${m.label} · ` : ''}{c.label}
          {t.type === 'transfer' ? ` · ${acc || '?'} → ${toAcc || '?'}` : acc ? ` · ${acc}` : ''}
          {!compact && t.merchant && t.description ? ` · ${t.merchant}` : ''}
          {t.source === 'voice' ? ' · 🎙️' : ''}{t.receiptUrl ? ' · 🧾' : ''}
        </p>
      </div>
      <p className={`font-semibold tabular-nums whitespace-nowrap ${m.cls}`}>{m.sign === '↔' ? '' : m.sign}{formatCurrency(Math.abs(t.amount))}</p>
      {!compact && (
        <div className="flex gap-1 opacity-70 group-hover:opacity-100">
          <button aria-label="Edit" onClick={() => edit(t)} className="p-2 text-gray-400 hover:text-primary-500 rounded-lg"><PencilIcon className="w-4 h-4" /></button>
          <button aria-label="Delete" onClick={del} className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}

/** Day-grouped list with per-day income / expense / net (the Daily view). */
export default function TransactionList({ txs, emptyText = 'No transactions in this period' }: { txs: Transaction[]; emptyText?: string }) {
  const { open } = useQuickAdd()
  if (!txs.length) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <p className="text-3xl mb-2">🧾</p>
        <p>{emptyText}</p>
        <button className="mt-3 text-primary-500 text-sm" onClick={() => open('expense')}>+ Add a transaction</button>
      </div>
    )
  }
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {groupByDay(txs).map(g => (
        <div key={g.date} className="py-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <span>{formatDateKey(g.date, { weekday: true, year: true })}</span>
            <span className="normal-case font-medium">
              {g.summary.income > 0 && <span className="text-green-600 mr-2">+{formatCurrency(g.summary.income)}</span>}
              {g.summary.netExpenses > 0 && <span className="text-red-600 mr-2">−{formatCurrency(g.summary.netExpenses)}</span>}
              <span className={g.summary.netCashFlow >= 0 ? 'text-gray-700 dark:text-gray-200' : 'text-red-600'}>Net {g.summary.netCashFlow >= 0 ? '+' : '−'}{formatCurrency(Math.abs(g.summary.netCashFlow))}</span>
            </span>
          </div>
          {g.items.map(t => <TransactionRow key={t.id} t={t} />)}
        </div>
      ))}
    </div>
  )
}
