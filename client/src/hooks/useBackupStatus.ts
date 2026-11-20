import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useStorageMode } from '../lib/datastore/mode'
import { backupStatus, backupDue, type BackupStatus } from '../services/backup'

/** Backup status for the signed-in user; local-only accounts default to weekly reminders. */
export function useBackupStatus(): BackupStatus & { localOnly: boolean } {
  const uid = useAuthStore(s => s.firebaseUser?.uid)
  const localOnly = useStorageMode(s => s.mode === 'local')
  const read = () => (uid ? backupStatus(uid, localOnly ? 'weekly' : 'off') : { last: null, via: null, frequency: 'off' as const })
  const [st, setSt] = useState(read)
  useEffect(() => {
    setSt(read())
    const on = () => setSt(read())
    window.addEventListener('ff-backup-changed', on)
    window.addEventListener('storage', on)
    return () => { window.removeEventListener('ff-backup-changed', on); window.removeEventListener('storage', on) }
  }, [uid, localOnly]) // eslint-disable-line react-hooks/exhaustive-deps
  return { ...st, localOnly }
}

export function useBackupReminder(): { days: number; localOnly: boolean } | null {
  const st = useBackupStatus()
  const days = backupDue(st)
  return days == null ? null : { days, localOnly: st.localOnly }
}
