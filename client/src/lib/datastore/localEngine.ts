/**
 * On-device document store for "Local-only" privacy mode.
 *
 * Implements the subset of the Firestore modular API that FinanceFlow uses (refs, queries,
 * snapshots, batches, transactions, serverTimestamp/increment/deleteField) on top of IndexedDB,
 * so the rest of the app works unchanged while no financial data leaves the device.
 *
 * All of the signed-in user's documents are loaded into memory when the user is activated
 * (personal finance data is small) and every write is committed to IndexedDB before the
 * returned promise resolves. Listeners are notified after each committed write.
 */
import { Timestamp } from 'firebase/firestore'

type Data = Record<string, any>
export interface LocalRef { __local: true; kind: 'col' | 'doc'; path: string; id: string; c?: any[] }
type Listener = { path: string; kind: 'col' | 'doc'; run: () => void }

const DB_NAME = 'financeflow-local'
const STORE = 'docs'

// ───────────── sentinels ─────────────
const SERVER_TS = { __localSentinel: 'serverTimestamp' }
const DELETE = { __localSentinel: 'delete' }
export const serverTimestamp = () => SERVER_TS
export const deleteField = () => DELETE
export const increment = (n: number) => ({ __localSentinel: 'increment', n })
const isSentinel = (v: any, kind: string) => v && typeof v === 'object' && v.__localSentinel === kind

// ───────────── (de)serialisation: Timestamps survive IndexedDB and JSON ─────────────
export function encode(v: any): any {
  if (v instanceof Timestamp) return { __ts: [v.seconds, v.nanoseconds] }
  if (v && typeof v === 'object' && typeof v.toMillis === 'function' && 'seconds' in v && 'nanoseconds' in v) return { __ts: [v.seconds, v.nanoseconds] }
  if (v instanceof Date) return { __ts: [Math.floor(v.getTime() / 1000), (v.getTime() % 1000) * 1e6] }
  if (Array.isArray(v)) return v.map(encode)
  if (v && typeof v === 'object') { const o: Data = {}; for (const k of Object.keys(v)) if (v[k] !== undefined) o[k] = encode(v[k]); return o }
  return v
}
export function decode(v: any): any {
  if (Array.isArray(v)) return v.map(decode)
  if (v && typeof v === 'object') {
    if (Array.isArray(v.__ts) && Object.keys(v).length === 1) return new Timestamp(v.__ts[0], v.__ts[1])
    const o: Data = {}; for (const k of Object.keys(v)) o[k] = decode(v[k]); return o
  }
  return v
}
const clone = (v: any): any => v instanceof Timestamp ? v : Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v
const isPlain = (v: any) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !v.__localSentinel

// ───────────── IndexedDB helpers ─────────────
let dbp: Promise<IDBDatabase> | null = null
function idb(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('This browser cannot store data on the device (IndexedDB unavailable).'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { dbp = null; reject(req.error) }
  })
  return dbp
}
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('aborted')) })

// ───────────── the store ─────────────
const store = new Map<string, Data>()
const listeners = new Set<Listener>()
let activeUid: string | null = null
let ready: Promise<void> = Promise.resolve()

const userRange = (uid: string) => IDBKeyRange.bound(`users/${uid}`, `users/${uid}￿`)

/** Load one user's documents from the device. Safe to call repeatedly. */
export function activate(uid: string): Promise<void> {
  if (activeUid === uid) return ready
  activeUid = uid
  store.clear()
  ready = (async () => {
    const db = await idb()
    const tx = db.transaction(STORE, 'readonly')
    const os = tx.objectStore(STORE)
    const [keys, values] = await Promise.all([
      new Promise<IDBValidKey[]>((res, rej) => { const r = os.getAllKeys(userRange(uid)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }),
      new Promise<any[]>((res, rej) => { const r = os.getAll(userRange(uid)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }),
    ])
    keys.forEach((k, i) => store.set(String(k), decode(values[i])))
  })()
  ready.then(() => notify(null)).catch(() => undefined)
  return ready
}
export function deactivate() { activeUid = null; store.clear(); ready = Promise.resolve() }
export const whenReady = () => ready
export const activeUser = () => activeUid

async function persist(changes: Map<string, Data | null>) {
  const db = await idb()
  const tx = db.transaction(STORE, 'readwrite')
  const os = tx.objectStore(STORE)
  for (const [path, data] of changes) data ? os.put(encode(data), path) : os.delete(path)
  await done(tx)
}

function notify(changed: Set<string> | null) {
  queueMicrotask(() => listeners.forEach(l => {
    if (!changed) return l.run()
    for (const p of changed) {
      if (l.kind === 'doc' ? p === l.path : p.startsWith(l.path + '/') && !p.slice(l.path.length + 1).includes('/')) return l.run()
    }
  }))
}

/** Apply a set of writes atomically: memory first, then IndexedDB; rolled back if the disk write fails. */
async function commit(ops: ((get: (p: string) => Data | undefined, put: (p: string, d: Data | null) => void) => void)[]) {
  await ready
  const changes = new Map<string, Data | null>()
  const get = (p: string) => (changes.has(p) ? changes.get(p) ?? undefined : store.get(p))
  const put = (p: string, d: Data | null) => { changes.set(p, d) }
  ops.forEach(op => op(get, put))
  const before = new Map([...changes.keys()].map(k => [k, store.get(k)]))
  for (const [p, d] of changes) d ? store.set(p, d) : store.delete(p)
  try { await persist(changes) } catch (e) {
    for (const [p, d] of before) d ? store.set(p, d) : store.delete(p)
    throw e
  }
  notify(new Set(changes.keys()))
}

// ───────────── write semantics (match Firestore) ─────────────
function applyValue(prev: any, v: any): any {
  if (isSentinel(v, 'serverTimestamp')) return Timestamp.now()
  if (isSentinel(v, 'increment')) return (Number(prev) || 0) + v.n
  return clone(v)
}
function setData(prev: Data | undefined, patch: Data, merge: boolean): Data {
  if (!merge) {
    const out: Data = {}
    for (const [k, v] of Object.entries(patch)) if (v !== undefined && !isSentinel(v, 'delete')) out[k] = isPlain(v) ? setData(undefined, v, false) : applyValue(undefined, v)
    return out
  }
  const out: Data = prev ? { ...prev } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if (isSentinel(v, 'delete')) delete out[k]
    else if (isPlain(v)) out[k] = setData(isPlain(out[k]) ? out[k] : undefined, v, true)
    else out[k] = applyValue(out[k], v)
  }
  return out
}
/** updateDoc: top-level keys replace, "a.b" keys are field paths. */
function updateData(prev: Data, patch: Data): Data {
  const out: Data = clone(prev)
  for (const [key, v] of Object.entries(patch)) {
    if (v === undefined) continue
    const parts = key.split('.')
    let node = out
    for (const p of parts.slice(0, -1)) { if (!isPlain(node[p])) node[p] = {}; node = node[p] }
    const last = parts[parts.length - 1]
    if (isSentinel(v, 'delete')) delete node[last]
    else node[last] = isPlain(v) ? setData(undefined, v, false) : applyValue(node[last], v)
  }
  return out
}

// ───────────── refs & queries ─────────────
const AUTO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
export function autoId() {
  const a = new Uint8Array(20); crypto.getRandomValues(a)
  return Array.from(a, b => AUTO[b % AUTO.length]).join('')
}
const join = (base: string, segs: string[]) => [base, ...segs].filter(Boolean).join('/')
export function collection(parent: any, ...segs: string[]): LocalRef {
  const path = join(parent?.__local ? parent.path : '', segs)
  return { __local: true, kind: 'col', path, id: path.split('/').pop()! }
}
export function doc(parent: any, ...segs: string[]): LocalRef {
  let path = join(parent?.__local ? parent.path : '', segs)
  if (parent?.__local && parent.kind === 'col' && !segs.length) path = `${parent.path}/${autoId()}`
  return { __local: true, kind: 'doc', path, id: path.split('/').pop()! }
}
export const where = (field: string, op: string, value: any) => ({ t: 'where', field, op, value })
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({ t: 'order', field, dir })
export const limit = (n: number) => ({ t: 'limit', n })
export function query(col: LocalRef, ...c: any[]): LocalRef { return { ...col, c: [...(col.c || []), ...c] } }

const val = (v: any) => (v instanceof Timestamp ? v.toMillis() : v)
const cmp = (a: any, b: any) => { const x = val(a), y = val(b); return x < y ? -1 : x > y ? 1 : 0 }
const getField = (d: Data, f: string) => f.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), d)

function snapDoc(path: string) {
  const d = store.get(path)
  return {
    id: path.split('/').pop()!, ref: { __local: true, kind: 'doc', path, id: path.split('/').pop()! } as LocalRef,
    exists: () => !!d, data: () => (d ? clone(d) : undefined), get: (f: string) => (d ? clone(getField(d, f)) : undefined),
    metadata: { hasPendingWrites: false, fromCache: true },
  }
}
function matches(v: any, op: string, value: any): boolean {
  switch (op) {
    case '==': return v !== undefined && cmp(v, value) === 0
    case '!=': return v !== undefined && cmp(v, value) !== 0
    case '<': return v !== undefined && v !== null && typeof val(v) === typeof val(value) && cmp(v, value) < 0
    case '<=': return v !== undefined && v !== null && typeof val(v) === typeof val(value) && cmp(v, value) <= 0
    case '>': return v !== undefined && v !== null && typeof val(v) === typeof val(value) && cmp(v, value) > 0
    case '>=': return v !== undefined && v !== null && typeof val(v) === typeof val(value) && cmp(v, value) >= 0
    case 'in': return Array.isArray(value) && value.some(x => cmp(v, x) === 0)
    case 'not-in': return v !== undefined && Array.isArray(value) && !value.some(x => cmp(v, x) === 0)
    case 'array-contains': return Array.isArray(v) && v.some(x => cmp(x, value) === 0)
    case 'array-contains-any': return Array.isArray(v) && Array.isArray(value) && v.some(x => value.some(y => cmp(x, y) === 0))
    default: throw new Error(`Unsupported query operator ${op}`)
  }
}
function runQuery(q: LocalRef) {
  const prefix = q.path + '/'
  let docs = [...store.keys()].filter(k => k.startsWith(prefix) && !k.slice(prefix.length).includes('/')).map(snapDoc)
  for (const c of q.c || []) if (c.t === 'where') docs = docs.filter(d => matches(getField(store.get(d.ref.path)!, c.field), c.op, c.value))
  const orders = (q.c || []).filter((c: any) => c.t === 'order')
  if (orders.length) {
    docs = docs.filter(d => orders.every((o: any) => getField(store.get(d.ref.path)!, o.field) !== undefined))
    docs.sort((a, b) => { for (const o of orders) { const r = cmp(getField(store.get(a.ref.path)!, o.field), getField(store.get(b.ref.path)!, o.field)); if (r) return o.dir === 'desc' ? -r : r } return a.id < b.id ? -1 : 1 })
  } else docs.sort((a, b) => (a.id < b.id ? -1 : 1))
  const lim = (q.c || []).find((c: any) => c.t === 'limit'); if (lim) docs = docs.slice(0, lim.n)
  return { docs, empty: !docs.length, size: docs.length, forEach: (fn: (d: any) => void) => docs.forEach(fn), metadata: { fromCache: true, hasPendingWrites: false } }
}

// ───────────── API ─────────────
export async function getDoc(ref: LocalRef) { await ready; return snapDoc(ref.path) }
export async function getDocs(q: LocalRef) { await ready; return runQuery(q) }
export async function setDoc(ref: LocalRef, data: Data, opts?: { merge?: boolean }) {
  await commit([(get, put) => put(ref.path, setData(get(ref.path), data, !!opts?.merge))])
}
export async function updateDoc(ref: LocalRef, data: Data) {
  await ready
  if (!store.has(ref.path)) { const e: any = new Error(`No document to update: ${ref.path}`); e.code = 'not-found'; throw e }
  await commit([(get, put) => put(ref.path, updateData(get(ref.path)!, data))])
}
export async function addDoc(col: LocalRef, data: Data) { const r = doc(col); await setDoc(r, data); return r }
export async function deleteDoc(ref: LocalRef) { await commit([(_g, put) => put(ref.path, null)]) }

export function writeBatch() {
  const ops: Parameters<typeof commit>[0] = []
  const b = {
    set(ref: LocalRef, d: Data, o?: { merge?: boolean }) { ops.push((get, put) => put(ref.path, setData(get(ref.path), d, !!o?.merge))); return b },
    update(ref: LocalRef, d: Data) {
      ops.push((get, put) => { const prev = get(ref.path); if (!prev) { const e: any = new Error(`No document to update: ${ref.path}`); e.code = 'not-found'; throw e } put(ref.path, updateData(prev, d)) })
      return b
    },
    delete(ref: LocalRef) { ops.push((_g, put) => put(ref.path, null)); return b },
    async commit() { await commit(ops) },
  }
  return b
}

let txChain: Promise<any> = Promise.resolve()
export function runTransaction<T>(_db: any, fn: (t: any) => Promise<T>): Promise<T> {
  // Transactions on one device run one at a time, so reads and writes are consistent.
  const run = txChain.then(async () => {
    await ready
    const b = writeBatch()
    const t = {
      get: async (r: LocalRef) => snapDoc(r.path),
      set: (r: LocalRef, d: Data, o?: any) => { b.set(r, d, o); return t },
      update: (r: LocalRef, d: Data) => { b.update(r, d); return t },
      delete: (r: LocalRef) => { b.delete(r); return t },
    }
    const res = await fn(t)
    await b.commit()
    return res
  })
  txChain = run.catch(() => undefined)
  return run
}

export function onSnapshot(target: LocalRef, a: any, b?: any, c?: any) {
  const next = typeof a === 'function' ? a : b
  const err = typeof a === 'function' ? b : c
  const run = () => { try { next(target.kind === 'doc' ? snapDoc(target.path) : runQuery(target)) } catch (e) { err?.(e) } }
  const l: Listener = { path: target.path, kind: target.kind, run }
  listeners.add(l)
  ready.then(() => { if (listeners.has(l)) run() }, e => err?.(e))
  return () => { listeners.delete(l) }
}

// ───────────── bulk helpers used by backup/restore and mode switching ─────────────
/** Every document of the active user, encoded (Timestamps as {__ts}). */
export async function dumpUser(uid: string): Promise<Record<string, Data>> {
  await activate(uid)
  const out: Record<string, Data> = {}
  for (const [k, v] of store) if (k === `users/${uid}` || k.startsWith(`users/${uid}/`)) out[k] = encode(v)
  return out
}
/** Replace every document of a user on this device with `docs` (encoded form). */
export async function replaceUser(uid: string, docs: Record<string, Data>) {
  await activate(uid)
  await commit([(_get, put) => {
    for (const k of store.keys()) if (k === `users/${uid}` || k.startsWith(`users/${uid}/`)) put(k, null)
    for (const [k, v] of Object.entries(docs)) put(k, decode(v))
  }])
  notify(null)
}
/** Remove a user's on-device data entirely. */
export async function wipeUser(uid: string) {
  const db = await idb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(userRange(uid))
  await done(tx)
  if (activeUid === uid) { store.clear(); notify(null) }
}
export const docCount = () => store.size
