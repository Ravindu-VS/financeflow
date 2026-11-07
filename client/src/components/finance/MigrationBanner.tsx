import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { useFinanceStore } from '../../store/financeStore'
import { accountService, migrationService, type MigrationRecord } from '../../services/financeService'
import type { MigrationPlan } from '../../lib/finance'
import { validateMigrationPlan } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'

function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/**
 * One-time, non-destructive upgrade of pre-existing income/expense/savings/investment records
 * into the transaction model: 1) backup  2) analyse  3) migrate  4) validate totals.
 */
export default function MigrationBanner() {
  const { needsMigration, accounts, checkMigration } = useFinanceStore()
  const [step, setStep] = useState<'idle' | 'backed_up' | 'planned' | 'running' | 'done'>('idle')
  const [legacy, setLegacy] = useState<any>(null)
  const [plan, setPlan] = useState<MigrationPlan | null>(null)
  const [accId, setAccId] = useState<string>('')
  const [result, setResult] = useState<MigrationRecord | null>(null)
  const [busy, setBusy] = useState(false)
  if (!needsMigration && step !== 'done') return null

  const backup = async () => {
    setBusy(true)
    try {
      const data = await migrationService.readLegacy()
      setLegacy(data)
      download(`financeflow-backup-${new Date().toISOString().slice(0, 10)}.json`, migrationService.backupJSON(data))
      setStep('backed_up')
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  const analyse = async () => {
    setBusy(true)
    try {
      const id = await accountService.ensureDefaults(accounts)
      setAccId(id)
      setPlan(migrationService.plan(legacy, id))
      setStep('planned')
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  const run = async () => {
    if (!plan) return
    setStep('running'); setBusy(true)
    try {
      const rec = await migrationService.execute(plan, accId)
      setResult(rec); setStep('done')
      rec.status === 'completed' ? toast.success('Upgrade complete — totals verified') : toast.error('Upgrade finished with problems — see details')
      checkMigration()
    } catch (e: any) { toast.error(e.message); setStep('planned') } finally { setBusy(false) }
  }

  const v = plan ? validateMigrationPlan(plan) : null
  const Row = ({ k, label }: { k: 'income' | 'expense' | 'savings' | 'investment'; label: string }) => (
    <tr className="border-t border-amber-200/50 dark:border-amber-800/50">
      <td className="py-1">{label}</td>
      <td className="py-1 text-right tabular-nums">{formatCurrency(plan!.totalsBefore[k])}</td>
      <td className="py-1 text-right tabular-nums">{formatCurrency(plan!.totalsAfter[k])}</td>
      <td className={`py-1 text-right ${Math.abs(v!.diffs[k]) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>{Math.abs(v!.diffs[k]) < 0.01 ? '✓' : formatCurrency(v!.diffs[k])}</td>
    </tr>
  )

  return (
    <div className="card p-4 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 space-y-3">
      <div>
        <h3 className="font-semibold text-amber-900 dark:text-amber-200">Upgrade your data to the new transaction model</h3>
        <p className="text-sm text-amber-800 dark:text-amber-300">Your existing income, expenses, savings contributions and investments become individual transactions so one-time and irregular entries, monthly views and transfers work correctly. Your original records are not changed or deleted.</p>
      </div>
      {step === 'idle' && <button disabled={busy} onClick={backup} className="btn btn-primary">{busy ? 'Reading…' : '1. Download backup'}</button>}
      {step === 'backed_up' && <button disabled={busy} onClick={analyse} className="btn btn-primary">{busy ? 'Analysing…' : '2. Analyse my data'}</button>}
      {(step === 'planned' || step === 'running') && plan && v && (
        <div className="space-y-2 text-sm text-amber-900 dark:text-amber-200">
          <p>{plan.counts.incomes} income · {plan.counts.expenses} expense · {plan.counts.contributions} savings contribution · {plan.counts.investments} investment records → {plan.transactions.length} transactions. {plan.counts.rules} recurring item(s) become reminder rules (you can switch on auto-recording later).</p>
          <table className="w-full text-xs"><thead><tr><th className="text-left">Total</th><th className="text-right">Before</th><th className="text-right">After</th><th className="text-right">Check</th></tr></thead>
            <tbody><Row k="income" label="Income" /><Row k="expense" label="Expenses" /><Row k="savings" label="Savings" /><Row k="investment" label="Investments" /></tbody></table>
          {plan.skipped.length > 0 && <p className="text-xs">⚠️ {plan.skipped.length} invalid record(s) will be skipped (kept in your backup): {plan.skipped.slice(0, 5).map(s => `${s.collection}/${s.id} (${s.reason})`).join(', ')}</p>}
          {plan.warnings.map(w => <p key={w} className="text-xs">ℹ️ {w}</p>)}
          <button disabled={busy} onClick={run} className="btn btn-primary">{step === 'running' ? 'Migrating…' : '3. Upgrade now'}</button>
        </div>
      )}
      {step === 'done' && result && (
        <div className="text-sm">
          <p className={result.status === 'completed' ? 'text-green-700 dark:text-green-300' : 'text-red-600'}>
            {result.status === 'completed' ? `✓ ${result.verifiedCount} transactions migrated and verified. Totals match.` : `Some records did not migrate: ${result.warnings.join('; ')}. You can run the upgrade again safely.`}
          </p>
          <button className="text-xs text-primary-600 mt-1" onClick={() => download('migration-report.json', JSON.stringify(result, null, 2))}>Download migration report</button>
        </div>
      )}
    </div>
  )
}
