import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import * as L from '../localEngine'

const tick = () => new Promise(r => setTimeout(r, 5))
const U = 'user-a'
const col = (name: string) => L.collection(null, 'users', U, name)
const ref = (name: string, id: string) => L.doc(null, 'users', U, name, id)

beforeEach(async () => { await L.wipeUser(U); await L.wipeUser('user-b'); L.deactivate(); await L.activate(U) })

describe('local on-device store', () => {
  it('writes survive a restart (persisted in IndexedDB) with Timestamps intact', async () => {
    const at = Timestamp.fromMillis(1_700_000_000_123)
    await L.setDoc(ref('transactions', 't1'), { amount: 500, date: '2026-11-01', createdAt: at, tags: ['food'] })
    L.deactivate(); await L.activate(U)
    const s = await L.getDoc(ref('transactions', 't1'))
    expect(s.exists()).toBe(true)
    expect(s.data()!.amount).toBe(500)
    expect(s.data()!.createdAt).toBeInstanceOf(Timestamp)
    expect(s.data()!.createdAt.toMillis()).toBe(1_700_000_000_123)
    expect(s.data()!.tags).toEqual(['food'])
  })

  it('implements merge, increment, serverTimestamp, deleteField and dotted updates like Firestore', async () => {
    await L.setDoc(ref('accounts', 'main'), { name: 'Main', balance: 100, meta: { a: 1, b: 2 } })
    await L.setDoc(ref('accounts', 'main'), { balance: L.increment(-30), meta: { b: 3 }, updatedAt: L.serverTimestamp() }, { merge: true })
    let d = (await L.getDoc(ref('accounts', 'main'))).data()!
    expect(d).toMatchObject({ name: 'Main', balance: 70, meta: { a: 1, b: 3 } })
    expect(d.updatedAt).toBeInstanceOf(Timestamp)
    await L.updateDoc(ref('accounts', 'main'), { 'meta.a': 9, name: L.deleteField() })
    d = (await L.getDoc(ref('accounts', 'main'))).data()!
    expect(d.name).toBeUndefined()
    expect(d.meta).toEqual({ a: 9, b: 3 })
    await L.setDoc(ref('accounts', 'main'), { name: 'Replaced' })
    expect((await L.getDoc(ref('accounts', 'main'))).data()).toEqual({ name: 'Replaced' })
    await expect(L.updateDoc(ref('accounts', 'missing'), { a: 1 })).rejects.toThrow(/No document/)
  })

  it('runs where / orderBy / limit queries and keeps users apart', async () => {
    for (const [id, date, amount] of [['a', '2026-10-30', 10], ['b', '2026-11-02', 20], ['c', '2026-11-05', 30], ['d', '2026-11-03', 40]] as const)
      await L.setDoc(ref('transactions', id), { date, amount, ...(id === 'c' ? { loanId: 'L1' } : {}) })
    await L.setDoc(L.doc(null, 'users', U, 'transactions', 'x', 'nested', 'n1'), { date: '2026-11-04' })
    const q = await L.getDocs(L.query(col('transactions'), L.where('date', '>=', '2026-11-01'), L.orderBy('date', 'desc'), L.limit(2)))
    expect(q.docs.map(d => d.id)).toEqual(['c', 'd'])
    const loans = await L.getDocs(L.query(col('transactions'), L.where('loanId', '>', '')))
    expect(loans.docs.map(d => d.id)).toEqual(['c'])
    await L.activate('user-b')
    expect((await L.getDocs(L.query(L.collection(null, 'users', 'user-b', 'transactions')))).size).toBe(0)
  })

  it('applies batches atomically and notifies only matching listeners', async () => {
    const seen: number[] = [], acct: number[] = []
    const un = L.onSnapshot(col('transactions'), (s: any) => seen.push(s.size))
    L.onSnapshot(ref('accounts', 'main'), (s: any) => acct.push(s.data()?.balance ?? -1))
    await tick()
    const b = L.writeBatch()
    b.set(L.doc(col('transactions')), { date: '2026-11-01', amount: 5 })
    b.set(ref('accounts', 'main'), { balance: L.increment(-5) }, { merge: true })
    await b.commit(); await tick()
    expect(seen).toEqual([0, 1])
    expect(acct).toEqual([-1, -5])
    await L.setDoc(ref('loans', 'L1'), { principal: 1 }); await tick()
    expect(seen).toEqual([0, 1]) // unrelated collection: no re-run
    un()
    const bad = L.writeBatch()
    bad.set(ref('transactions', 'z'), { amount: 1 })
    bad.update(ref('accounts', 'nope'), { x: 1 })
    await expect(bad.commit()).rejects.toThrow()
    expect((await L.getDoc(ref('transactions', 'z'))).exists()).toBe(false)
  })

  it('serialises transactions so concurrent read-modify-write is safe', async () => {
    await L.setDoc(ref('accounts', 'main'), { balance: 0 })
    await Promise.all(Array.from({ length: 10 }, () => L.runTransaction(null, async t => {
      const s = await t.get(ref('accounts', 'main'))
      t.set(ref('accounts', 'main'), { balance: s.data().balance + 1 })
    })))
    expect((await L.getDoc(ref('accounts', 'main'))).data()!.balance).toBe(10)
  })

  it('dumps, replaces and wipes a user', async () => {
    await L.setDoc(L.doc(null, 'users', U), { profile: { firstName: 'Kasun' } })
    await L.setDoc(ref('transactions', 't1'), { amount: 1, at: Timestamp.fromMillis(5000) })
    const dump = await L.dumpUser(U)
    expect(Object.keys(dump).sort()).toEqual([`users/${U}`, `users/${U}/transactions/t1`])
    expect(dump[`users/${U}/transactions/t1`].at).toEqual({ __ts: [5, 0] })
    await L.setDoc(ref('transactions', 't2'), { amount: 2 })
    await L.replaceUser(U, dump)
    expect((await L.getDoc(ref('transactions', 't2'))).exists()).toBe(false)
    expect((await L.getDoc(ref('transactions', 't1'))).data()!.at.toMillis()).toBe(5000)
    await L.wipeUser(U)
    L.deactivate(); await L.activate(U)
    expect((await L.getDoc(ref('transactions', 't1'))).exists()).toBe(false)
  })
})
