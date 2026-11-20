import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Card, SectionHeader, Modal } from '../ui'
import { useAuthStore } from '../../store/authStore'
import { useStorageMode } from '../../lib/datastore/mode'
import { moveToDevice, moveToCloud } from '../../services/storage'
import {
  createBackup, downloadBackup, parseBackupFile, restoreBackup, decryptBackup, markBackedUp, setReminderFrequency,
  MIN_PASSWORD, type BackupFile, type ReminderFrequency,
} from '../../services/backup'
import { driveConfigured, listDriveBackups, uploadDriveBackup, downloadDriveBackup, deleteDriveBackup, type DriveBackup } from '../../services/googleDrive'
import { useBackupStatus } from '../../hooks/useBackupStatus'
import { useFinanceStore } from '../../store/financeStore'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never')
const reload = () => setTimeout(() => window.location.reload(), 900)
// Live subscriptions are paused while data is moved or replaced, so no screen reacts to the
// half-finished state (e.g. by re-creating default accounts); the page reloads afterwards.
const pauseData = () => useFinanceStore.getState().stop()
const resumeData = (uid: string) => useFinanceStore.getState().init(uid)

/** Settings → Privacy & Backup: where data is stored, encrypted backups, Google Drive, reminders. */
export default function PrivacyPanel() {
  const user = useAuthStore(s => s.firebaseUser)
  const mode = useStorageMode(s => s.mode)
  const status = useBackupStatus()
  const [switching, setSwitching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [restoreFrom, setRestoreFrom] = useState<{ file: BackupFile; source: string } | null>(null)
  const [drive, setDrive] = useState<DriveBackup[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const uid = user?.uid
  if (!uid) return null
  const local = mode === 'local'

  const pwOk = password.length >= MIN_PASSWORD && password === confirm
  const pwHint = password && password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters` : confirm && password !== confirm ? 'Passwords do not match' : ''

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try { await fn() } catch (e: any) { toast.error(e?.message || 'Something went wrong') } finally { setBusy(null) }
  }

  const backupToFile = () => run('Encrypting…', async () => {
    const file = await createBackup(uid, password)
    downloadBackup(file)
    markBackedUp(uid, 'file')
    toast.success(`Backup saved (${file.documents} records). Keep the password safe — it cannot be recovered.`)
  })
  const backupToDrive = () => run('Uploading to Google Drive…', async () => {
    const file = await createBackup(uid, password)
    await uploadDriveBackup(file)
    markBackedUp(uid, 'drive')
    setDrive(await listDriveBackups())
    toast.success('Encrypted backup saved to your Google Drive')
  })
  const loadDrive = () => run('Opening Google Drive…', async () => { setDrive(await listDriveBackups()) })
  const pickFile = async (f: File | undefined) => {
    if (!f) return
    try { setRestoreFrom({ file: parseBackupFile(await f.text()), source: f.name }) } catch (e: any) { toast.error(e.message) }
    if (fileInput.current) fileInput.current.value = ''
  }
  const pickDrive = (b: DriveBackup) => run('Downloading…', async () => { setRestoreFrom({ file: await downloadDriveBackup(b.id), source: 'Google Drive' }) })
  const removeDrive = (b: DriveBackup) => run('Deleting…', async () => {
    if (!window.confirm(`Delete the backup from ${new Date(b.createdTime).toLocaleString()} from Google Drive?`)) return
    await deleteDriveBackup(b.id); setDrive(await listDriveBackups())
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="lg:col-span-2">
        <SectionHeader title="Where your data is stored" subtitle="You choose: synced in the cloud, or kept only on this device" />
        <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Data storage">
          <ModeOption active={!local} icon="☁️" title="Cloud sync" text="Stored in your private, encrypted Firebase account. Works on all your devices; nothing is lost if this device is." />
          <ModeOption active={local} icon="📱" title="This device only" text="Your financial data never leaves this device. Only a 'local-only' flag is kept in the cloud, with no financial data. Back up regularly." />
        </div>
        {local && (
          <p className="mt-3 text-sm rounded-xl p-3 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            AI chat, the health score, server reports, family and advisor features send your data to FinanceFlow's servers when you use them. Everything else works fully on this device, including offline.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn btn-secondary" onClick={() => setSwitching(true)} disabled={!!busy}>
            {local ? '☁️ Move my data back to cloud sync' : '📱 Keep my data only on this device'}
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400" data-testid="storage-mode">Now: <b>{local ? 'This device only' : 'Cloud sync'}</b></span>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Encrypted backup" subtitle="AES-256 encryption with your password — only you can open it" />
        <div className="space-y-3">
          <label className="block"><span className="label">Backup password</span>
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD} characters`} />
          </label>
          <label className="block"><span className="label">Repeat password</span>
            <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </label>
          {pwHint && <p className="text-xs text-red-600 dark:text-red-400">{pwHint}</p>}
          <p className="text-xs text-gray-500 dark:text-gray-400">If you forget this password the backup cannot be opened by anyone, including us.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={!pwOk || !!busy} onClick={backupToFile}>⬇️ Download backup file</button>
            {driveConfigured() && <button className="btn btn-secondary" disabled={!pwOk || !!busy} onClick={backupToDrive}>☁️ Back up to Google Drive</button>}
          </div>
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Restore</p>
            <input ref={fileInput} type="file" accept=".ffbackup,application/json,application/octet-stream" className="hidden" aria-label="Choose backup file" onChange={e => pickFile(e.target.files?.[0])} />
            <button className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={!!busy}>📂 Restore from a file…</button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Google Drive" subtitle="Saved in a hidden FinanceFlow folder in your own Drive" />
        {!driveConfigured() ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Google Drive backup is not switched on for this site yet. Use backup files in the meantime.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">FinanceFlow can only see its own backups, never your other files. Backups are encrypted before they leave this device; the newest 10 are kept.</p>
            <button className="btn btn-secondary" onClick={loadDrive} disabled={!!busy}>{drive ? '🔄 Refresh list' : '🔗 Connect Google Drive'}</button>
            {drive && (drive.length ? (
              <ul className="space-y-2">
                {drive.map(b => (
                  <li key={b.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <span className="text-sm text-gray-900 dark:text-white">{new Date(b.createdTime).toLocaleString()} <span className="text-gray-500">· {Math.max(1, Math.round(b.size / 1024))} KB</span></span>
                    <span className="flex gap-1">
                      <button className="btn btn-secondary py-1 text-xs" onClick={() => pickDrive(b)} disabled={!!busy}>Restore</button>
                      <button className="btn btn-secondary py-1 text-xs" onClick={() => removeDrive(b)} disabled={!!busy} aria-label="Delete backup">🗑</button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-500">No backups in Google Drive yet.</p>)}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <SectionHeader title="Backup reminders" />
          <p className="text-sm text-gray-700 dark:text-gray-300" data-testid="last-backup">Last backup: <b>{when(status.last)}</b>{status.via ? ` (${status.via === 'drive' ? 'Google Drive' : status.via === 'file' ? 'file' : 'restored'})` : ''}</p>
          <label className="block"><span className="label">Remind me</span>
            <select className="input" value={status.frequency} onChange={e => setReminderFrequency(uid, e.target.value as ReminderFrequency)}>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
              <option value="off">Never</option>
            </select>
          </label>
        </div>
      </Card>

      {busy && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm shadow-lg" role="status">{busy}</div>}

      {switching && <SwitchModal uid={uid} local={local} onClose={() => setSwitching(false)} />}
      {restoreFrom && <RestoreModal uid={uid} local={local} file={restoreFrom.file} source={restoreFrom.source} onClose={() => setRestoreFrom(null)} />}
    </div>
  )
}

function ModeOption({ active, icon, title, text }: { active: boolean; icon: string; title: string; text: string }) {
  return (
    <div role="radio" aria-checked={active} className={`p-4 rounded-xl border-2 ${active ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
      <p className="font-semibold text-gray-900 dark:text-white">{icon} {title} {active && <span className="ml-1 text-xs font-medium text-primary-700 dark:text-primary-300">(current)</span>}</p>
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{text}</p>
    </div>
  )
}

function SwitchModal({ uid, local, onClose }: { uid: string; local: boolean; onClose: () => void }) {
  const [ack, setAck] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const go = async () => {
    setProgress('Starting…')
    pauseData()
    try {
      const r = local ? await moveToCloud(uid, setProgress) : await moveToDevice(uid, setProgress)
      toast.success(local ? `Moved ${r.moved} records to cloud sync` : `Moved ${r.moved} records to this device and removed them from the cloud`)
      reload()
    } catch (e: any) {
      toast.error(e?.message || 'Could not move your data'); setProgress(null); resumeData(uid)
    }
  }
  return (
    <Modal isOpen onClose={() => !progress && onClose()} title={local ? 'Move back to cloud sync?' : 'Keep data only on this device?'}>
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        {local ? (
          <p>Your data will be uploaded to your private Firebase account and synced to your other devices. The copy on this device is then removed.</p>
        ) : (
          <>
            <p>All your transactions, accounts, budgets, goals and loans will be copied to this device, checked, and then <b>deleted from the cloud</b>.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Other phones or computers will no longer see your data.</li>
              <li>If this device is lost, reset, or the browser data is cleared, your data is gone unless you have a backup.</li>
              <li>Weekly backup reminders will be turned on.</li>
            </ul>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={ack} onChange={e => setAck(e.target.checked)} /> <span>I understand and will keep backups.</span></label>
          </>
        )}
        {progress && <p className="font-medium" role="status">{progress}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-secondary" onClick={onClose} disabled={!!progress}>Cancel</button>
          <button className="btn btn-primary" onClick={go} disabled={!!progress || (!local && !ack)}>{local ? 'Move to cloud' : 'Move to this device'}</button>
        </div>
      </div>
    </Modal>
  )
}

function RestoreModal({ uid, local, file, source, onClose }: { uid: string; local: boolean; file: BackupFile; source: string; onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [checked, setChecked] = useState<number | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { setChecked(null); setError('') }, [pw])
  const check = async () => {
    setProgress('Unlocking…'); setError('')
    try { const c = await decryptBackup(file, pw); setChecked(Object.keys(c.docs).length) } catch (e: any) { setError(e.message) }
    setProgress(null)
  }
  const go = async () => {
    setProgress('Restoring…')
    pauseData()
    try { await restoreBackup(uid, file, pw, setProgress); toast.success('Backup restored'); reload() } catch (e: any) { setError(e.message); setProgress(null); resumeData(uid) }
  }
  return (
    <Modal isOpen onClose={() => !progress && onClose()} title="Restore a backup">
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>From <b>{source}</b> · made {new Date(file.createdAt).toLocaleString()} · {file.documents} records</p>
        <label className="block"><span className="label">Backup password</span>
          <input className="input" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && pw && check()} autoFocus />
        </label>
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
        {checked != null && (
          <p className="rounded-xl p-3 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            Password correct. Restoring <b>replaces all current data</b> {local ? 'on this device' : 'in your cloud account'} with these {checked} records.
          </p>
        )}
        {progress && <p className="font-medium" role="status">{progress}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-secondary" onClick={onClose} disabled={!!progress}>Cancel</button>
          {checked == null
            ? <button className="btn btn-primary" onClick={check} disabled={!pw || !!progress}>Unlock</button>
            : <button className="btn btn-danger bg-red-600 hover:bg-red-700 text-white" onClick={go} disabled={!!progress}>Replace my data</button>}
        </div>
      </div>
    </Modal>
  )
}
