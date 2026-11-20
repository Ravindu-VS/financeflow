import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStorageMode } from '../../lib/datastore/mode'
import { useFinanceStore } from '../../store/financeStore'

/**
 * Local-only accounts on a device with no data yet (a new phone, or cleared browser data):
 * point the user to restoring a backup before they start over.
 */
export default function LocalModeBanner() {
  const local = useStorageMode(s => s.mode === 'local')
  const { ready, transactions, accounts, loans } = useFinanceStore()
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('ff_hide_restore_hint') === '1' } catch { return false } })
  const empty = ready.txs && ready.accounts && !transactions.length && !loans.length && accounts.every(a => !a.balance)
  if (!local || !empty || hidden) return null
  const hide = () => { try { sessionStorage.setItem('ff_hide_restore_hint', '1') } catch { /* ignore */ } setHidden(true) }
  return (
    <div className="mb-4 p-4 rounded-xl border border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-100 flex flex-col sm:flex-row sm:items-center gap-3" role="note">
      <p className="text-sm flex-1">📱 Your data is kept only on your own devices, and this device has none yet. <b>New phone or computer?</b> Restore your encrypted backup to continue where you left off.</p>
      <div className="flex gap-2">
        <Link to="/settings?tab=privacy" className="btn btn-primary py-1.5 text-sm">Restore a backup</Link>
        <button className="btn btn-secondary py-1.5 text-sm" onClick={hide}>Start fresh</button>
      </div>
    </div>
  )
}
