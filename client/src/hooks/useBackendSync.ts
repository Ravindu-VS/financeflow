/**
 * Keeps the hosted PostgreSQL copy in step with Firestore (the system of record).
 * Debounced auto-sync after changes, on reconnect, and on demand ("Sync now").
 */
import { useEffect, useCallback } from 'react'
import { create } from 'zustand'
import { useFinanceStore } from '../store/financeStore'
import { syncToBackend, lastSync, idToken } from '../services/backend'

interface SyncState { syncing: boolean; last: string | null; error: string | null; counts?: { upserted: number; deleted: number } }
export const useSyncStatus = create<SyncState>(() => ({ syncing: false, last: lastSync(), error: null }))

let running: Promise<void> | null = null

export async function runSync(): Promise<void> {
  if (running) return running
  running = (async () => {
    const { transactions, goals, holdings, windowStart } = useFinanceStore.getState()
    if (!(await idToken())) throw new Error('Sign in to sync')
    useSyncStatus.setState({ syncing: true, error: null })
    try {
      const r = await syncToBackend(transactions, goals, holdings, windowStart, '2099-12-31')
      useSyncStatus.setState({ syncing: false, last: new Date().toISOString(), error: null, counts: r.transactions })
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Sync failed'
      useSyncStatus.setState({ syncing: false, error: typeof msg === 'string' ? msg : 'Sync failed' })
      throw e
    }
  })().finally(() => { running = null })
  return running
}

export function useSyncNow() {
  return useCallback(() => runSync(), [])
}

/** Mount once (in the dashboard layout). */
export function useAutoSync() {
  const { transactions, goals, holdings, ready, uid } = useFinanceStore()
  useEffect(() => {
    if (!uid || !ready.txs || !navigator.onLine) return
    const t = setTimeout(() => { runSync().catch(() => undefined) }, 8000)
    return () => clearTimeout(t)
  }, [uid, ready.txs, transactions, goals, holdings])
  useEffect(() => {
    const on = () => runSync().catch(() => undefined)
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [])
}
