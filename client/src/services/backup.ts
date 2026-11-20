/**
 * Encrypted backups.
 *
 * A backup is every document of the account, gzip-compressed and encrypted on the device with
 * AES-256-GCM. The key comes from the user's backup password (PBKDF2-SHA-256, 310,000 rounds),
 * so neither FinanceFlow nor Google can read a backup without that password. Only the creation
 * date and document count are stored unencrypted.
 *
 * Backups can be downloaded as a .ffbackup file or saved to the user's own Google Drive (in the
 * hidden app-data folder, which only FinanceFlow can see).
 */
import { dumpAccount, restoreAccount, countDocs } from './storage'

export const BACKUP_FORMAT = 'financeflow-backup' as const
const ITERATIONS = 310_000
export const MIN_PASSWORD = 8

type Docs = Record<string, Record<string, any>>
export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: 1
  createdAt: string
  documents: number
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  data: string
}
export interface BackupContents { exportedAt: string; docs: Docs }

// ───────────── encoding helpers ─────────────
const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
const unb64 = (s: string): Bytes => Uint8Array.from(atob(s), c => c.charCodeAt(0))

type Bytes = Uint8Array<ArrayBuffer>
async function pipe(data: Bytes, stream: CompressionStream | DecompressionStream): Promise<Bytes> {
  const out = new Response(new Blob([data]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}
const canCompress = () => typeof CompressionStream !== 'undefined'

async function deriveKey(password: string, salt: Bytes, iterations: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

// ───────────── encrypt / decrypt ─────────────
export async function encryptBackup(contents: BackupContents, password: string): Promise<BackupFile> {
  if (password.length < MIN_PASSWORD) throw new Error(`Use a backup password of at least ${MIN_PASSWORD} characters.`)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const json = new TextEncoder().encode(JSON.stringify({ ...contents, compressed: canCompress() }))
  const plain: Bytes = canCompress() ? await pipe(json, new CompressionStream('gzip')) : json
  const key = await deriveKey(password, salt, ITERATIONS)
  // The header (format, date, count) is authenticated too, so it cannot be altered unnoticed.
  const header = { format: BACKUP_FORMAT as typeof BACKUP_FORMAT, version: 1 as const, createdAt: contents.exportedAt, documents: countDocs(contents.docs) }
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(JSON.stringify(header)) }, key, plain))
  return { ...header, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: b64(salt) }, cipher: { name: 'AES-GCM', iv: b64(iv) }, data: b64(cipher) }
}

export function parseBackupFile(text: string): BackupFile {
  let f: any
  try { f = JSON.parse(text) } catch { throw new Error('This is not a FinanceFlow backup file.') }
  if (f?.format !== BACKUP_FORMAT || !f.kdf?.salt || !f.cipher?.iv || typeof f.data !== 'string') throw new Error('This is not a FinanceFlow backup file.')
  if (f.version !== 1) throw new Error('This backup was made by a newer version of FinanceFlow. Update the app and try again.')
  return f
}

export async function decryptBackup(file: BackupFile, password: string): Promise<BackupContents> {
  const key = await deriveKey(password, unb64(file.kdf.salt), file.kdf.iterations)
  const header = { format: file.format, version: file.version, createdAt: file.createdAt, documents: file.documents }
  let plain: Bytes
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.cipher.iv), additionalData: new TextEncoder().encode(JSON.stringify(header)) }, key, unb64(file.data)))
  } catch {
    throw new Error('Wrong password, or the backup file is damaged.')
  }
  const gz = plain[0] === 0x1f && plain[1] === 0x8b
  const json = gz ? await pipe(plain, new DecompressionStream('gzip')) : plain
  const c = JSON.parse(new TextDecoder().decode(json))
  if (!c?.docs || typeof c.docs !== 'object') throw new Error('The backup file is damaged.')
  return { exportedAt: c.exportedAt, docs: c.docs }
}

// ───────────── whole-account backup / restore ─────────────
export async function createBackup(uid: string, password: string): Promise<BackupFile> {
  const docs = await dumpAccount(uid)
  const profile = docs[`users/${uid}`]
  if (profile) delete profile.storageMode
  return encryptBackup({ exportedAt: new Date().toISOString(), docs }, password)
}

export async function restoreBackup(uid: string, file: BackupFile, password: string, onProgress?: (m: string) => void) {
  const contents = await decryptBackup(file, password)
  await restoreAccount(uid, contents.docs, onProgress)
  markBackedUp(uid, 'restore')
  return contents
}

export function backupFileName(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `FinanceFlow-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.ffbackup`
}

export function downloadBackup(file: BackupFile) {
  const blob = new Blob([JSON.stringify(file)], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = backupFileName(new Date(file.createdAt))
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ───────────── reminders ─────────────
export type ReminderFrequency = 'off' | 'weekly' | 'monthly'
const lastKey = (uid: string) => `ff_last_backup_${uid}`
const freqKey = (uid: string) => `ff_backup_reminder_${uid}`

export interface BackupStatus { last: string | null; via: string | null; frequency: ReminderFrequency }
export function backupStatus(uid: string, defaultFrequency: ReminderFrequency = 'weekly'): BackupStatus {
  try {
    const raw = localStorage.getItem(lastKey(uid))
    const parsed = raw ? JSON.parse(raw) : null
    const f = localStorage.getItem(freqKey(uid)) as ReminderFrequency | null
    return { last: parsed?.at || null, via: parsed?.via || null, frequency: f === 'off' || f === 'weekly' || f === 'monthly' ? f : defaultFrequency }
  } catch { return { last: null, via: null, frequency: defaultFrequency } }
}
export function markBackedUp(uid: string, via: 'file' | 'drive' | 'restore') {
  try { localStorage.setItem(lastKey(uid), JSON.stringify({ at: new Date().toISOString(), via })) } catch { /* ignore */ }
  window.dispatchEvent(new Event('ff-backup-changed'))
}
export function setReminderFrequency(uid: string, f: ReminderFrequency) {
  try { localStorage.setItem(freqKey(uid), f) } catch { /* ignore */ }
  window.dispatchEvent(new Event('ff-backup-changed'))
}
/** Days since the last backup when a reminder is due, otherwise null. */
export function backupDue(status: BackupStatus, now = new Date()): number | null {
  if (status.frequency === 'off') return null
  const limit = status.frequency === 'weekly' ? 7 : 30
  if (!status.last) return Infinity
  const days = Math.floor((now.getTime() - new Date(status.last).getTime()) / 86_400_000)
  return days >= limit ? days : null
}
