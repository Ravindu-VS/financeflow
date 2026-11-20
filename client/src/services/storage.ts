/**
 * Storage-mode lifecycle: deciding where a user's data lives when they sign in, and moving
 * all of it between Firestore and this device when they change the setting.
 */
import * as fs from 'firebase/firestore'
import { db } from '../config/firebase'
import * as local from '../lib/datastore/localEngine'
import { savedMode, rememberMode, setActiveMode, takePendingMode, currentMode, type StorageMode } from '../lib/datastore/mode'

/** Every per-user collection the app writes (Firestore cannot list subcollections from the web SDK). */
export const USER_COLLECTIONS = [
  'transactions', 'accounts', 'recurringRules', 'snapshots', 'meta', 'auditLogs', 'loans',
  'budgets', 'savingsGoals', 'investments', 'incomes', 'expenses',
] as const

const timeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
const resolving = new Map<string, Promise<StorageMode>>()

async function cloudMarker(uid: string): Promise<'local' | 'cloud' | 'none'> {
  const snap = await timeout(fs.getDoc(fs.doc(db, 'users', uid)), 6000)
  if (!snap.exists()) return 'none'
  return snap.data()?.storageMode === 'local' ? 'local' : 'cloud'
}

/** Decide (once per sign-in) whether this user is cloud or local-only, and open the device store. */
export function resolveStorage(uid: string): Promise<StorageMode> {
  const existing = resolving.get(uid)
  if (existing) return existing
  const p = (async (): Promise<StorageMode> => {
    const pending = takePendingMode()
    let mode = savedMode(uid)
    let uncertain = false
    if (!mode) {
      let marker: 'local' | 'cloud' | 'none' = 'cloud'
      // Offline on a device we have not seen: assume cloud for now, but check again next time.
      try { marker = await cloudMarker(uid) } catch { marker = pending ? 'none' : 'cloud'; uncertain = !pending }
      // A sign-up choice only applies to a brand-new account, never to one that already has cloud data.
      mode = marker === 'local' ? 'local' : marker === 'none' && pending ? pending : 'cloud'
      if (mode === 'local' && marker !== 'local') await writeLocalMarker(uid).catch(() => undefined)
    }
    if (!uncertain) rememberMode(uid, mode)
    setActiveMode(uid, mode)
    if (mode === 'local') await local.activate(uid)
    else local.deactivate()
    return mode
  })()
  resolving.set(uid, p)
  p.catch(() => resolving.delete(uid))
  return p
}

export function clearStorageSession() {
  resolving.clear()
  local.deactivate()
  setActiveMode(null, 'cloud')
}

/** The only thing a local-only user keeps in Firestore: a flag with no personal data. */
function writeLocalMarker(uid: string) {
  return fs.setDoc(fs.doc(db, 'users', uid), { storageMode: 'local', updatedAt: fs.serverTimestamp() })
}

// ───────────── reading / writing a whole account in Firestore ─────────────
type Docs = Record<string, Record<string, any>>

/** Prefer a fresh server read (so nothing is missed from a stale cache); fall back to the cache offline. */
async function fromServer<T>(server: () => Promise<T>, cached: () => Promise<T>): Promise<T> {
  try { return await server() } catch { return cached() }
}

export async function dumpCloud(uid: string): Promise<Docs> {
  const out: Docs = {}
  const profile = await fromServer(() => fs.getDocFromServer(fs.doc(db, 'users', uid)), () => fs.getDoc(fs.doc(db, 'users', uid)))
  if (profile.exists()) out[`users/${uid}`] = local.encode(profile.data())
  for (const name of USER_COLLECTIONS) {
    const c = fs.collection(db, 'users', uid, name)
    const snap = await fromServer(() => fs.getDocsFromServer(c), () => fs.getDocs(c))
    snap.docs.forEach(d => { out[`users/${uid}/${name}/${d.id}`] = local.encode(d.data()) })
  }
  return out
}

async function inChunks(paths: string[], each: (b: fs.WriteBatch, path: string) => void, onProgress?: (done: number) => void) {
  for (let i = 0; i < paths.length; i += 400) {
    const b = fs.writeBatch(db)
    paths.slice(i, i + 400).forEach(p => each(b, p))
    await b.commit()
    onProgress?.(Math.min(i + 400, paths.length))
  }
}

/** Delete every document of the account from Firestore (the profile doc becomes `replacement`). */
async function wipeCloud(uid: string, replacement: Record<string, any> | null, onProgress?: (msg: string) => void) {
  const existing = await dumpCloud(uid)
  const paths = Object.keys(existing).filter(p => p !== `users/${uid}`)
  await inChunks(paths, (b, p) => b.delete(fs.doc(db, p)), n => onProgress?.(`Removing cloud copy… ${n}/${paths.length}`))
  if (replacement) await fs.setDoc(fs.doc(db, 'users', uid), replacement)
  else await fs.deleteDoc(fs.doc(db, 'users', uid))
}

async function writeCloud(uid: string, docs: Docs, onProgress?: (msg: string) => void) {
  const paths = Object.keys(docs).filter(p => p === `users/${uid}` || p.startsWith(`users/${uid}/`))
  await inChunks(paths, (b, p) => b.set(fs.doc(db, p), local.decode(docs[p])), n => onProgress?.(`Uploading… ${n}/${paths.length}`))
}

const countDocs = (d: Docs) => Object.keys(d).length

/**
 * Cloud → this device. Copies everything, verifies the copy, then deletes it from Firestore,
 * leaving only the `{ storageMode: 'local' }` marker.
 */
export async function moveToDevice(uid: string, onProgress?: (msg: string) => void): Promise<{ moved: number }> {
  onProgress?.('Downloading your data…')
  const docs = await dumpCloud(uid)
  delete (docs[`users/${uid}`] || {}).storageMode
  onProgress?.('Saving on this device…')
  await local.replaceUser(uid, docs)
  const check = await local.dumpUser(uid)
  if (countDocs(check) !== countDocs(docs)) throw new Error('The copy on this device does not match the cloud. Nothing was deleted.')
  rememberMode(uid, 'local')
  setActiveMode(uid, 'local')
  await wipeCloud(uid, { storageMode: 'local', updatedAt: fs.serverTimestamp() }, onProgress)
  return { moved: countDocs(docs) }
}

/** This device → cloud. Uploads everything, verifies, then removes the device copy. */
export async function moveToCloud(uid: string, onProgress?: (msg: string) => void): Promise<{ moved: number }> {
  await local.activate(uid)
  const docs = await local.dumpUser(uid)
  if (!docs[`users/${uid}`]) docs[`users/${uid}`] = {}
  delete docs[`users/${uid}`].storageMode
  onProgress?.('Uploading your data…')
  await wipeCloud(uid, null)
  await writeCloud(uid, docs, onProgress)
  const check = await dumpCloud(uid)
  if (countDocs(check) < countDocs(docs)) throw new Error('Upload incomplete — your data is still on this device. Please try again.')
  rememberMode(uid, 'cloud')
  setActiveMode(uid, 'cloud')
  await local.wipeUser(uid)
  local.deactivate()
  return { moved: countDocs(docs) }
}

/** Everything belonging to the user, from wherever it currently lives (encoded form). */
export function dumpAccount(uid: string): Promise<Docs> {
  return currentMode() === 'local' ? local.dumpUser(uid) : dumpCloud(uid)
}

/** Replace the account's data with a backup, in whichever store is active. */
export async function restoreAccount(uid: string, docs: Docs, onProgress?: (msg: string) => void) {
  // Backups may come from another account id (e.g. a new sign-in): re-root the paths.
  const rerooted: Docs = {}
  for (const [p, v] of Object.entries(docs)) {
    const m = p.match(/^users\/[^/]+(\/.*)?$/)
    if (m) rerooted[`users/${uid}${m[1] || ''}`] = v
  }
  if (currentMode() === 'local') {
    const profile = rerooted[`users/${uid}`]
    if (profile) delete profile.storageMode
    await local.replaceUser(uid, rerooted)
  } else {
    onProgress?.('Replacing your cloud data…')
    await wipeCloud(uid, null)
    await writeCloud(uid, rerooted, onProgress)
  }
}

export { countDocs }
