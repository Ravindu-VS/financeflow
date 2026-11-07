/**
 * E2E fake of firebase/firestore — an in-memory document store implementing the subset of
 * the modular API this app uses (refs, queries, snapshots, batches, transactions, sentinels).
 * Exposed as window.__fakeDb for seeding and assertions in Playwright tests.
 */
type Data = Record<string, any>
const store = new Map<string, Data>()
const listeners = new Set<() => void>()
let auto = 0
const KEY = '__fakeFirestore'
const persist = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...store], (_k, v) => (v instanceof Timestamp ? { __ts: [v.seconds, v.nanoseconds] } : v)))
  } catch { /* ignore */ }
}
const notify = () => { persist(); queueMicrotask(() => listeners.forEach(l => l())) }

export class Timestamp {
  constructor(public seconds: number, public nanoseconds: number) {}
  static now() { return Timestamp.fromMillis(Date.now()) }
  static fromDate(d: Date) { return Timestamp.fromMillis(d.getTime()) }
  static fromMillis(ms: number) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6) }
  toDate() { return new Date(this.seconds * 1000 + this.nanoseconds / 1e6) }
  toMillis() { return this.toDate().getTime() }
}
const SERVER_TS = { __s: 'ts' }, DELETE = { __s: 'del' }
export const serverTimestamp = () => SERVER_TS
export const deleteField = () => DELETE
export const increment = (n: number) => ({ __s: 'inc', n })

export type Firestore = any; export type WriteBatch = any; export type Unsubscribe = () => void
export type DocumentData = Data; export type QueryConstraint = any
export const persistentLocalCache = (o?: any) => o, persistentMultipleTabManager = () => ({}), memoryLocalCache = () => ({})
const db = { __fake: true }
export function initializeFirestore() { return db }
export function getFirestore() { return db }

const join = (base: string, segs: string[]) => [base, ...segs].filter(Boolean).join('/')
export function collection(parent: any, ...segs: string[]) { return { kind: 'col', path: join(parent?.path || '', segs) } }
export function doc(parent: any, ...segs: string[]) {
  let path = join(parent?.path || '', segs)
  if (parent?.kind === 'col' && !segs.length) path = `${parent.path}/auto${(++auto).toString(36)}${Math.random().toString(36).slice(2, 8)}`
  return { kind: 'doc', path, id: path.split('/').pop()! }
}
export const where = (field: string, op: string, value: any) => ({ t: 'where', field, op, value })
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({ t: 'order', field, dir })
export const limit = (n: number) => ({ t: 'limit', n })
export function query(col: any, ...c: any[]) { return { kind: 'query', path: col.path, c: [...(col.c || []), ...c] } }

function resolve(prev: Data | undefined, patch: Data, merge: boolean): Data {
  const out: Data = merge && prev ? { ...prev } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === SERVER_TS) out[k] = Timestamp.now()
    else if (v === DELETE) delete out[k]
    else if (v && v.__s === 'inc') out[k] = (Number(out[k]) || 0) + v.n
    else out[k] = v
  }
  return out
}
// deep clone that preserves Timestamp instances (structuredClone would drop the prototype)
const clone = (v: any): any => v instanceof Timestamp ? v : Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v
const snapDoc = (path: string) => {
  const d = store.get(path)
  return { id: path.split('/').pop()!, ref: { path }, exists: () => !!d, data: () => (d ? clone(d) : undefined), metadata: { hasPendingWrites: false } }
}
const cmp = (a: any, b: any) => {
  const va = a instanceof Timestamp ? a.toMillis() : a, vb = b instanceof Timestamp ? b.toMillis() : b
  return va < vb ? -1 : va > vb ? 1 : 0
}
function runQuery(q: any) {
  const prefix = q.path + '/'
  let docs = [...store.keys()].filter(k => k.startsWith(prefix) && !k.slice(prefix.length).includes('/')).map(snapDoc)
  for (const c of q.c || []) {
    if (c.t === 'where') docs = docs.filter(d => {
      const v = d.data()![c.field]; const r = cmp(v, c.value)
      return v !== undefined && ({ '==': r === 0, '>=': r >= 0, '<=': r <= 0, '>': r > 0, '<': r < 0, '!=': r !== 0 } as any)[c.op]
    })
  }
  const orders = (q.c || []).filter((c: any) => c.t === 'order')
  if (orders.length) docs.sort((a, b) => { for (const o of orders) { const r = cmp(a.data()![o.field], b.data()![o.field]); if (r) return o.dir === 'desc' ? -r : r } return 0 })
  const lim = (q.c || []).find((c: any) => c.t === 'limit'); if (lim) docs = docs.slice(0, lim.n)
  return { docs, empty: !docs.length, size: docs.length, metadata: { fromCache: false, hasPendingWrites: false } }
}
export async function getDoc(ref: any) { return snapDoc(ref.path) }
export async function getDocs(q: any) { return runQuery(q) }
export async function setDoc(ref: any, data: Data, opts?: { merge?: boolean }) { store.set(ref.path, resolve(store.get(ref.path), data, !!opts?.merge)); notify() }
export async function updateDoc(ref: any, data: Data) { if (!store.has(ref.path)) throw new Error('not-found'); store.set(ref.path, resolve(store.get(ref.path), data, true)); notify() }
export async function addDoc(col: any, data: Data) { const r = doc(col); await setDoc(r, data); return r }
export async function deleteDoc(ref: any) { store.delete(ref.path); notify() }
export function writeBatch() {
  const ops: (() => void)[] = []
  const b = {
    set(ref: any, d: Data, o?: any) { ops.push(() => store.set(ref.path, resolve(store.get(ref.path), d, !!o?.merge))); return b },
    update(ref: any, d: Data) { ops.push(() => store.set(ref.path, resolve(store.get(ref.path), d, true))); return b },
    delete(ref: any) { ops.push(() => store.delete(ref.path)); return b },
    async commit() { ops.forEach(o => o()); notify() },
  }
  return b
}
export async function runTransaction(_db: any, fn: (t: any) => Promise<any>) {
  const b = writeBatch()
  const t = { get: async (r: any) => snapDoc(r.path), set: (r: any, d: Data, o?: any) => { b.set(r, d, o); return t }, update: (r: any, d: Data) => { b.update(r, d); return t }, delete: (r: any) => { b.delete(r); return t } }
  const res = await fn(t); await b.commit(); return res
}
export function onSnapshot(target: any, a: any, b?: any, c?: any) {
  const next = typeof a === 'function' ? a : b
  const err = typeof a === 'function' ? b : c
  const run = () => { try { next(target.kind === 'doc' ? snapDoc(target.path) : runQuery(target)) } catch (e) { err?.(e) } }
  listeners.add(run); queueMicrotask(run)
  return () => { listeners.delete(run) }
}

try {
  const raw = sessionStorage.getItem(KEY)
  if (raw) for (const [k, v] of JSON.parse(raw, (_k, v) => (v && v.__ts ? new Timestamp(v.__ts[0], v.__ts[1]) : v))) store.set(k, v)
} catch { /* ignore */ }

;(globalThis as any).__fakeDb = {
  store, Timestamp,
  seed(path: string, data: Data) { store.set(path, data); notify() },
  dump(prefix = '') { return Object.fromEntries([...store].filter(([k]) => k.startsWith(prefix))) },
  list(colPath: string) { return runQuery({ path: colPath, c: [] }).docs.map(d => ({ id: d.id, ...d.data() })) },
  clear() { store.clear(); notify() },
}
