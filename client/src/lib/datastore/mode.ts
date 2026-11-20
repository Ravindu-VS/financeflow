/**
 * Where the signed-in user's financial data lives:
 *   'cloud' — Firebase Firestore (synced across devices; the default)
 *   'local' — only on this device (IndexedDB). Nothing is written to Firestore except a
 *             one-field marker `users/{uid} = { storageMode: 'local' }`, so another device
 *             knows to offer a restore instead of starting an empty cloud account.
 */
import { create } from 'zustand'

export type StorageMode = 'cloud' | 'local'

const key = (uid: string) => `ff_storage_mode_${uid}`
const PENDING = 'ff_storage_mode_pending'

interface ModeState { uid: string | null; mode: StorageMode }
export const useStorageMode = create<ModeState>(() => ({ uid: null, mode: 'cloud' }))

export const currentMode = (): StorageMode => useStorageMode.getState().mode
export const isLocalMode = () => currentMode() === 'local'

export function savedMode(uid: string): StorageMode | null {
  try { const v = localStorage.getItem(key(uid)); return v === 'local' || v === 'cloud' ? v : null } catch { return null }
}
export function rememberMode(uid: string, mode: StorageMode) {
  try { localStorage.setItem(key(uid), mode) } catch { /* private mode: falls back to the cloud marker */ }
}
export function setActiveMode(uid: string | null, mode: StorageMode) {
  useStorageMode.setState({ uid, mode })
}

/** Choice made on the sign-up page before the account (and its uid) exists. */
export function setPendingMode(mode: StorageMode | null) {
  try { mode ? sessionStorage.setItem(PENDING, mode) : sessionStorage.removeItem(PENDING) } catch { /* ignore */ }
}
export function takePendingMode(): StorageMode | null {
  try { const v = sessionStorage.getItem(PENDING); sessionStorage.removeItem(PENDING); return v === 'local' || v === 'cloud' ? v : null } catch { return null }
}
