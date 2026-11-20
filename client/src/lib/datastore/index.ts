/**
 * Data-access facade with the same shape as the Firestore modular API.
 *
 * Services import from here instead of 'firebase/firestore'. Each call goes to Firestore
 * (cloud mode) or to the on-device store (local-only mode), so the app's data code does not
 * need to know where data lives. See ./mode.ts and ./localEngine.ts.
 */
import * as fs from 'firebase/firestore'
import * as local from './localEngine'
import { isLocalMode } from './mode'

export { Timestamp } from 'firebase/firestore'
export type { WriteBatch, Unsubscribe, DocumentData, QueryConstraint, Firestore } from 'firebase/firestore'
export { useStorageMode, isLocalMode, currentMode } from './mode'
export type { StorageMode } from './mode'

const isLocal = (r: any) => !!r?.__local
const useLocal = (parent: any) => isLocal(parent) || isLocalMode()

// Query constraints are created lazily so they match whichever store the query runs on.
type C = { __c: 'where' | 'orderBy' | 'limit'; a: any[] }
export const where = (field: string, op: fs.WhereFilterOp, value: unknown): fs.QueryFieldFilterConstraint => ({ __c: 'where', a: [field, op, value] } as C as any)
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): fs.QueryOrderByConstraint => ({ __c: 'orderBy', a: [field, dir] } as C as any)
export const limit = (n: number): fs.QueryLimitConstraint => ({ __c: 'limit', a: [n] } as C as any)
const toFs = (c: any) => (c?.__c === 'where' ? fs.where(c.a[0], c.a[1], c.a[2]) : c?.__c === 'orderBy' ? fs.orderBy(c.a[0], c.a[1]) : c?.__c === 'limit' ? fs.limit(c.a[0]) : c)
const toLocal = (c: any) => (c?.__c === 'where' ? local.where(c.a[0], c.a[1], c.a[2]) : c?.__c === 'orderBy' ? local.orderBy(c.a[0], c.a[1]) : c?.__c === 'limit' ? local.limit(c.a[0]) : c)

export const collection = ((parent: any, path: string, ...segs: string[]) =>
  useLocal(parent) ? local.collection(isLocal(parent) ? parent : null, path, ...segs) : fs.collection(parent, path, ...segs)) as unknown as typeof fs.collection
export const doc = ((parent: any, ...segs: string[]) => {
  if (useLocal(parent)) return local.doc(isLocal(parent) ? parent : null, ...segs)
  return segs.length ? (fs.doc as any)(parent, ...segs) : fs.doc(parent)
}) as unknown as typeof fs.doc
export const query = ((col: any, ...c: any[]) =>
  isLocal(col) ? local.query(col, ...c.map(toLocal)) : fs.query(col, ...c.map(toFs))) as unknown as typeof fs.query

export const getDoc = ((r: any) => (isLocal(r) ? local.getDoc(r) : fs.getDoc(r))) as unknown as typeof fs.getDoc
export const getDocs = ((q: any) => (isLocal(q) ? local.getDocs(q) : fs.getDocs(q))) as unknown as typeof fs.getDocs
export const setDoc = (r: any, d: any, o?: fs.SetOptions): Promise<void> => (isLocal(r) ? local.setDoc(r, d, o as any) : o ? fs.setDoc(r, d, o) : fs.setDoc(r, d))
export const updateDoc = (r: any, d: any): Promise<void> => (isLocal(r) ? local.updateDoc(r, d) : fs.updateDoc(r, d))
export const addDoc = ((c: any, d: any) => (isLocal(c) ? local.addDoc(c, d) : fs.addDoc(c, d))) as unknown as typeof fs.addDoc
export const deleteDoc = (r: any): Promise<void> => (isLocal(r) ? local.deleteDoc(r) : fs.deleteDoc(r))
export const onSnapshot = ((target: any, ...rest: any[]) =>
  isLocal(target) ? (local.onSnapshot as any)(target, ...rest) : (fs.onSnapshot as any)(target, ...rest)) as unknown as typeof fs.onSnapshot
export const writeBatch = ((db: fs.Firestore) => (isLocalMode() ? local.writeBatch() : fs.writeBatch(db))) as unknown as typeof fs.writeBatch
export const runTransaction = ((db: fs.Firestore, fn: (t: any) => Promise<any>) =>
  isLocalMode() ? local.runTransaction(db, fn) : fs.runTransaction(db, fn)) as unknown as typeof fs.runTransaction
export const serverTimestamp = (): fs.FieldValue => (isLocalMode() ? local.serverTimestamp() as any : fs.serverTimestamp())
export const increment = (n: number): fs.FieldValue => (isLocalMode() ? local.increment(n) as any : fs.increment(n))
export const deleteField = (): fs.FieldValue => (isLocalMode() ? local.deleteField() as any : fs.deleteField())
