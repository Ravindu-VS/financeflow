/**
 * Encrypted backups in the user's own Google Drive.
 *
 * Uses Google Identity Services to get a short-lived access token for the `drive.appdata`
 * scope only: FinanceFlow can see just its own hidden app-data folder, never the user's files.
 * Backups are encrypted on the device before upload (see ./backup.ts).
 *
 * Setup: set VITE_GOOGLE_CLIENT_ID (or GOOGLE_CLIENT_ID below) to the project's OAuth web client
 * ID, enable the Google Drive API in the Google Cloud project, and add the site origins to the
 * client's "Authorized JavaScript origins".
 */
import type { BackupFile } from './backup'
import { parseBackupFile, backupFileName } from './backup'

/** Public OAuth web client ID (not a secret). Leave empty to use VITE_GOOGLE_CLIENT_ID. */
const GOOGLE_CLIENT_ID = ''
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const KEEP = 10 // newest backups kept in Drive

export const driveClientId = () => (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || GOOGLE_CLIENT_ID
export const driveConfigured = () => !!driveClientId()

let token: { value: string; expires: number } | null = null
let gisLoading: Promise<void> | null = null

function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve()
  if (!gisLoading) gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { gisLoading = null; reject(new Error('Could not reach Google. Check your connection.')) }
    document.head.appendChild(s)
  })
  return gisLoading
}

/** Ask Google for permission (a popup the first time); cached for the token's lifetime. */
export async function connectDrive(hint?: string): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value
  if (!driveConfigured()) throw new Error('Google Drive backup is not set up for this site yet.')
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: driveClientId(),
      scope: SCOPE,
      hint,
      callback: (r: any) => {
        if (r.error || !r.access_token) return reject(new Error(r.error === 'access_denied' ? 'Google Drive access was not allowed.' : r.error_description || 'Google sign-in failed.'))
        if (!(window as any).google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) return reject(new Error('Please allow FinanceFlow to store its backups in your Drive.'))
        token = { value: r.access_token, expires: Date.now() + (Number(r.expires_in) || 3600) * 1000 }
        resolve(token.value)
      },
      error_callback: (e: any) => reject(new Error(e?.type === 'popup_closed' ? 'The Google window was closed.' : 'Google sign-in failed.')),
    })
    client.requestAccessToken()
  })
}
export function disconnectDrive() {
  if (token) (window as any).google?.accounts?.oauth2?.revoke?.(token.value, () => undefined)
  token = null
}

async function api(path: string, init: RequestInit = {}, upload = false): Promise<Response> {
  const t = await connectDrive()
  const res = await fetch(`https://www.googleapis.com/${upload ? 'upload/' : ''}drive/v3/${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${t}` } })
  if (res.status === 401) { token = null; throw new Error('Google sign-in expired. Try again.') }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.error?.message || `Google Drive error ${res.status}`
    throw new Error(/has not been used|is disabled/i.test(msg) ? 'The Google Drive API is not enabled for this app yet.' : msg)
  }
  return res
}

export interface DriveBackup { id: string; name: string; createdTime: string; size: number }

export async function listDriveBackups(): Promise<DriveBackup[]> {
  const q = encodeURIComponent("name contains 'FinanceFlow-backup' and trashed = false")
  const r = await api(`files?spaces=appDataFolder&q=${q}&orderBy=createdTime desc&pageSize=100&fields=files(id,name,createdTime,size)`)
  const j = await r.json()
  return (j.files || []).map((f: any) => ({ id: f.id, name: f.name, createdTime: f.createdTime, size: Number(f.size) || 0 }))
}

export async function uploadDriveBackup(file: BackupFile): Promise<DriveBackup> {
  const boundary = 'ff' + Math.random().toString(36).slice(2)
  const meta = { name: backupFileName(new Date(file.createdAt)), parents: ['appDataFolder'], mimeType: 'application/octet-stream' }
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${JSON.stringify(file)}\r\n--${boundary}--`
  const r = await api('files?uploadType=multipart&fields=id,name,createdTime,size', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }, true)
  const f = await r.json()
  // Keep the newest backups only.
  try {
    const all = await listDriveBackups()
    await Promise.all(all.slice(KEEP).map(old => api(`files/${old.id}`, { method: 'DELETE' })))
  } catch { /* pruning is best-effort */ }
  return { id: f.id, name: f.name, createdTime: f.createdTime, size: Number(f.size) || 0 }
}

export async function downloadDriveBackup(id: string): Promise<BackupFile> {
  const r = await api(`files/${encodeURIComponent(id)}?alt=media`)
  return parseBackupFile(await r.text())
}

export async function deleteDriveBackup(id: string) {
  await api(`files/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
