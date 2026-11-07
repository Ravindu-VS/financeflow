/**
 * Firestore data layer for the transaction-centric model.
 *
 *   users/{uid}/transactions/{id}    actual financial events
 *   users/{uid}/accounts/{id}        cash, bank, card, savings, … (cached `balance`)
 *   users/{uid}/recurringRules/{id}  templates that may generate transactions
 *   users/{uid}/snapshots/{YYYY-MM}  month-end financial snapshots
 *   users/{uid}/meta/settings        planning settings (reserve, commitments, dismissed suggestions)
 *   users/{uid}/meta/migration       migration record (version, totals before/after)
 *   users/{uid}/auditLogs/{id}       write audit trail
 *
 * Legacy collections (incomes, expenses, savingsGoals[contributions], investments) are read
 * only by the migration and are never modified or deleted.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, limit as qlimit, onSnapshot,
  writeBatch, increment, runTransaction, serverTimestamp, Timestamp, WriteBatch, Unsubscribe, deleteField,
} from 'firebase/firestore'
import { onAuthStateChanged, User } from 'firebase/auth'
import { db, auth } from '../config/firebase'
import type { Account, RecurringRule, Transaction, PeriodRange, PeriodSummary } from '../lib/finance'
import {
  balanceEffects, buildOccurrence, pendingOccurrences, planLegacyMigration, validateMigrationPlan, MigrationPlan,
  todayKey, summarize, computeBalances, netWorth, startOfMonth, endOfMonth, addMonths, expensesByCategory, isValidDateKey, type LegacyData,
} from '../lib/finance'

export const MIGRATION_VERSION = 1

// ───────────────────────── auth helpers ─────────────────────────

export function currentUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) return resolve(auth.currentUser)
    const un = onAuthStateChanged(auth, u => { un(); u ? resolve(u) : reject(new Error('Not authenticated')) })
    setTimeout(() => { un(); auth.currentUser ? resolve(auth.currentUser) : reject(new Error('Not authenticated')) }, 4000)
  })
}

const col = (uid: string, name: string) => collection(db, 'users', uid, name)
const ref = (uid: string, name: string, id: string) => doc(db, 'users', uid, name, id)

/** Strip undefined (Firestore rejects it) and client-only fields. */
function clean<T extends Record<string, any>>(o: T): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || k === 'id') continue
    out[k] = v
  }
  return out
}

function fromDoc<T>(id: string, data: any): T {
  const o: any = { id, ...data }
  for (const k of ['createdAt', 'updatedAt']) {
    const v = o[k]
    if (v?.toDate) o[k] = v.toDate().toISOString()
    else if (v && typeof v.seconds === 'number') o[k] = new Date(v.seconds * 1000).toISOString()
    else if (v != null && typeof v !== 'string') o[k] = undefined // pending serverTimestamp etc.
  }
  return o as T
}

const onListenError = (what: string) => (e: Error) => console.error(`[firestore] ${what} listener failed`, e)

export const newId = (name = 'transactions') => doc(col('_', name)).id

/**
 * Commit a batch in an offline-friendly way. Firestore applies the write to the local cache
 * immediately; the server ack only arrives when online. We don't block the UI on the ack:
 * resolve once the server confirms or after a short grace period (then it is queued).
 */
export async function commit(batch: WriteBatch): Promise<{ queued: boolean }> {
  const p = batch.commit()
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    p.catch(e => console.error('[sync] queued write failed', e))
    return { queued: true }
  }
  const timeout = new Promise<'t'>(r => setTimeout(() => r('t'), 4000))
  const res = await Promise.race([p.then(() => 'ok' as const), timeout])
  if (res === 't') { p.catch(e => console.error('[sync] write failed', e)); return { queued: true } }
  return { queued: false }
}

function audit(batch: WriteBatch, uid: string, action: string, entity: string, entityId: string, extra: Record<string, any> = {}) {
  batch.set(doc(col(uid, 'auditLogs')), { action, entity, entityId, at: serverTimestamp(), ...extra })
}

function applyBalance(batch: WriteBatch, uid: string, t: Pick<Transaction, 'type' | 'amount' | 'accountId' | 'toAccountId' | 'status'>, sign: 1 | -1, knownAccounts?: Set<string>) {
  for (const e of balanceEffects(t)) {
    if (knownAccounts && !knownAccounts.has(e.accountId)) continue
    batch.set(ref(uid, 'accounts', e.accountId), { balance: increment(sign * e.delta) }, { merge: true })
  }
}

// ───────────────────────── transactions ─────────────────────────

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

export const transactionService = {
  async create(t: NewTransaction, opts: { accounts?: Account[] } = {}) {
    const u = await currentUser()
    if (!isValidDateKey(t.date)) throw new Error('Invalid date')
    const id = t.id || doc(col(u.uid, 'transactions')).id
    const batch = writeBatch(db)
    const data = { ...clean(t), amount: Math.round(Number(t.amount) * 100) / 100, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    batch.set(ref(u.uid, 'transactions', id), data)
    applyBalance(batch, u.uid, t, 1, opts.accounts ? new Set(opts.accounts.map(a => a.id)) : undefined)
    audit(batch, u.uid, 'create', 'transaction', id, { type: t.type, amount: data.amount, source: t.source })
    const r = await commit(batch)
    return { id, ...r }
  },

  /** Edit an existing transaction. Balance effects of the old version are reversed and the new ones applied. */
  async update(before: Transaction, patch: Partial<Transaction>, opts: { accounts?: Account[] } = {}) {
    const u = await currentUser()
    const after = { ...before, ...patch }
    if (!isValidDateKey(after.date)) throw new Error('Invalid date')
    const batch = writeBatch(db)
    const known = opts.accounts ? new Set(opts.accounts.map(a => a.id)) : undefined
    applyBalance(batch, u.uid, before, -1, known)
    applyBalance(batch, u.uid, after, 1, known)
    const data: Record<string, any> = { ...clean(patch), updatedAt: serverTimestamp() }
    for (const [k, v] of Object.entries(patch)) if (v === undefined) data[k] = deleteField()
    batch.set(ref(u.uid, 'transactions', before.id), data, { merge: true })
    audit(batch, u.uid, 'update', 'transaction', before.id, { fields: Object.keys(patch) })
    return commit(batch)
  },

  async remove(t: Transaction, opts: { accounts?: Account[] } = {}) {
    const u = await currentUser()
    const batch = writeBatch(db)
    applyBalance(batch, u.uid, t, -1, opts.accounts ? new Set(opts.accounts.map(a => a.id)) : undefined)
    batch.delete(ref(u.uid, 'transactions', t.id))
    audit(batch, u.uid, 'delete', 'transaction', t.id, { type: t.type, amount: t.amount, date: t.date })
    return commit(batch)
  },

  async bulkCreate(list: NewTransaction[], accounts?: Account[]) {
    const u = await currentUser()
    const known = accounts ? new Set(accounts.map(a => a.id)) : undefined
    let n = 0
    for (let i = 0; i < list.length; i += 150) {
      const batch = writeBatch(db)
      for (const t of list.slice(i, i + 150)) {
        const id = t.id || doc(col(u.uid, 'transactions')).id
        batch.set(ref(u.uid, 'transactions', id), { ...clean(t), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        applyBalance(batch, u.uid, t, 1, known)
        n++
      }
      audit(batch, u.uid, 'bulk_create', 'transaction', `batch_${i}`, { count: Math.min(150, list.length - i) })
      await batch.commit()
    }
    return n
  },

  /** Efficient date-range query (single-field range + order: no composite index required). */
  async listRange(r: PeriodRange): Promise<Transaction[]> {
    const u = await currentUser()
    const snap = await getDocs(query(col(u.uid, 'transactions'), where('date', '>=', r.start), where('date', '<=', r.end), orderBy('date', 'desc')))
    return snap.docs.map(d => fromDoc<Transaction>(d.id, d.data()))
  },

  async listAll(): Promise<Transaction[]> {
    const u = await currentUser()
    const snap = await getDocs(query(col(u.uid, 'transactions'), orderBy('date', 'desc')))
    return snap.docs.map(d => fromDoc<Transaction>(d.id, d.data()))
  },

  /** Live subscription to a date window (used for the rolling history window). */
  subscribeRange(uid: string, from: string, cb: (txs: Transaction[], meta: { pending: number; fromCache: boolean }) => void, onError?: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      query(col(uid, 'transactions'), where('date', '>=', from), orderBy('date', 'desc')),
      { includeMetadataChanges: true },
      snap => cb(
        snap.docs.map(d => fromDoc<Transaction>(d.id, d.data())),
        { pending: snap.docs.filter(d => d.metadata.hasPendingWrites).length, fromCache: snap.metadata.fromCache },
      ),
      e => onError?.(e),
    )
  },
}

// ───────────────────────── accounts ─────────────────────────

export const accountService = {
  subscribe(uid: string, cb: (a: Account[]) => void): Unsubscribe {
    return onSnapshot(col(uid, 'accounts'), s => cb(s.docs.map(d => fromDoc<Account>(d.id, d.data())).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.name.localeCompare(b.name))), onListenError('accounts'))
  },
  async create(a: Omit<Account, 'id' | 'balance'>) {
    const u = await currentUser()
    const id = doc(col(u.uid, 'accounts')).id
    const batch = writeBatch(db)
    batch.set(ref(u.uid, 'accounts', id), { ...clean(a), balance: Number(a.openingBalance) || 0, createdAt: serverTimestamp() })
    audit(batch, u.uid, 'create', 'account', id)
    await commit(batch)
    return id
  },
  async update(a: Account, patch: Partial<Account>) {
    const u = await currentUser()
    const batch = writeBatch(db)
    const data: Record<string, any> = clean(patch)
    if (patch.openingBalance !== undefined && patch.openingBalance !== a.openingBalance) {
      data.balance = increment((Number(patch.openingBalance) || 0) - (Number(a.openingBalance) || 0))
    }
    batch.set(ref(u.uid, 'accounts', a.id), data, { merge: true })
    audit(batch, u.uid, 'update', 'account', a.id, { fields: Object.keys(patch) })
    return commit(batch)
  },
  /** Ensure the user has at least a Cash and a Bank account. Returns the default (bank) account id. */
  async ensureDefaults(existing: Account[]): Promise<string> {
    if (existing.length) return (existing.find(a => a.type === 'bank') || existing[0]).id
    const u = await currentUser()
    const batch = writeBatch(db)
    batch.set(ref(u.uid, 'accounts', 'main'), { name: 'Main Account', type: 'bank', currency: 'LKR', openingBalance: 0, balance: 0, createdAt: serverTimestamp() }, { merge: true })
    batch.set(ref(u.uid, 'accounts', 'cash'), { name: 'Cash', type: 'cash', currency: 'LKR', openingBalance: 0, balance: 0, createdAt: serverTimestamp() }, { merge: true })
    await commit(batch)
    return 'main'
  },
  /** Repair cached balances by recomputing from opening balances + all transactions. */
  async recalculate(accounts: Account[]) {
    const u = await currentUser()
    const all = await transactionService.listAll()
    const bal = computeBalances(accounts, all)
    const batch = writeBatch(db)
    for (const a of accounts) batch.set(ref(u.uid, 'accounts', a.id), { balance: bal[a.id] ?? 0 }, { merge: true })
    audit(batch, u.uid, 'recalculate', 'account', 'all')
    await commit(batch)
    return bal
  },
}

// ───────────────────────── recurring rules ─────────────────────────

export const recurringService = {
  subscribe(uid: string, cb: (r: RecurringRule[]) => void): Unsubscribe {
    return onSnapshot(col(uid, 'recurringRules'), s => cb(s.docs.map(d => fromDoc<RecurringRule>(d.id, d.data()))), onListenError('recurringRules'))
  },
  async save(r: Omit<RecurringRule, 'id'> & { id?: string }) {
    const u = await currentUser()
    const id = r.id || doc(col(u.uid, 'recurringRules')).id
    const batch = writeBatch(db)
    // Saving a rule NEVER touches existing transactions: history is immutable.
    batch.set(ref(u.uid, 'recurringRules', id), { ...clean(r), updatedAt: serverTimestamp(), ...(r.id ? {} : { createdAt: serverTimestamp() }) }, { merge: true })
    audit(batch, u.uid, r.id ? 'update' : 'create', 'recurringRule', id)
    await commit(batch)
    return id
  },
  async remove(id: string) {
    const u = await currentUser()
    const batch = writeBatch(db)
    batch.delete(ref(u.uid, 'recurringRules', id))
    audit(batch, u.uid, 'delete', 'recurringRule', id)
    return commit(batch)
  },
  async skip(r: RecurringRule, date: string) {
    return this.save({ ...r, skippedDates: [...new Set([...(r.skippedDates || []), date])] })
  },
  /**
   * Materialise due occurrences for auto-generating rules. Runs in a Firestore transaction
   * (online only) so two tabs/devices can never create the same occurrence twice; ids are
   * deterministic as a second guard.
   */
  async generateDue(rules: RecurringRule[], accounts: Account[], today = todayKey()): Promise<number> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0
    const u = await currentUser()
    const known = new Set(accounts.map(a => a.id))
    let created = 0
    for (const r of rules) {
      const due = pendingOccurrences(r, today)
      if (!due.length) continue
      created += await runTransaction(db, async trx => {
        const rRef = ref(u.uid, 'recurringRules', r.id)
        const fresh = await trx.get(rRef)
        if (!fresh.exists()) return 0
        const cur = fromDoc<RecurringRule>(fresh.id, fresh.data())
        const list = pendingOccurrences(cur, today)
        const refs = list.map(d => ref(u.uid, 'transactions', buildOccurrence(cur, d).id))
        const exist = await Promise.all(refs.map(x => trx.get(x)))
        let n = 0
        list.forEach((d, i) => {
          if (exist[i].exists()) return
          const t = buildOccurrence(cur, d)
          trx.set(refs[i], { ...clean(t), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
          for (const e of balanceEffects(t)) if (known.has(e.accountId)) trx.set(ref(u.uid, 'accounts', e.accountId), { balance: increment(e.delta) }, { merge: true })
          n++
        })
        if (list.length) trx.set(rRef, { lastGeneratedDate: list[list.length - 1] }, { merge: true })
        return n
      })
    }
    return created
  },
}

// ───────────────────────── settings ─────────────────────────

export interface PlanningSettings {
  emergencyReserve: number
  monthlySavingsTarget: number
  monthlyInvestmentTarget: number
  budgetMethod: 'category' | 'monthly' | 'flexible' | 'savings_first' | 'zero_based'
  monthlyBudget?: number
  dismissedSuggestions: string[]
  customCategories: { id: string; label: string; icon: string; color: string }[]
}

export const DEFAULT_SETTINGS: PlanningSettings = {
  emergencyReserve: 0, monthlySavingsTarget: 0, monthlyInvestmentTarget: 0, budgetMethod: 'category', dismissedSuggestions: [], customCategories: [],
}

export const settingsService = {
  subscribe(uid: string, cb: (s: PlanningSettings) => void): Unsubscribe {
    return onSnapshot(ref(uid, 'meta', 'settings'), s => cb({ ...DEFAULT_SETTINGS, ...(s.data() || {}) } as PlanningSettings), onListenError('settings'))
  },
  async save(patch: Partial<PlanningSettings>) {
    const u = await currentUser()
    await setDoc(ref(u.uid, 'meta', 'settings'), clean(patch), { merge: true })
  },
}

// ───────────────────────── month-end snapshots ─────────────────────────

export const snapshotService = {
  async list(): Promise<any[]> {
    const u = await currentUser()
    const s = await getDocs(query(col(u.uid, 'snapshots'), orderBy('month', 'desc'), qlimit(36)))
    return s.docs.map(d => d.data())
  },
  /**
   * Month-end processing, run lazily on app start (no server cron needed): for each completed
   * month in the last 12 without a snapshot, store income/expense/savings/investment/net worth.
   */
  async ensureSnapshots(txs: Transaction[], accounts: Account[], holdingsValue: number, budgets: { category: string; amount: number }[], today = todayKey()) {
    if (!txs.length) return 0
    const u = await currentUser()
    const existing = new Set((await this.list()).map(s => s.month))
    const earliest = txs.reduce((m, t) => (t.date < m ? t.date : m), today)
    const batch = writeBatch(db)
    let n = 0
    for (let i = 1; i <= 12; i++) {
      const start = addMonths(startOfMonth(today), -i, 1)
      const month = start.slice(0, 7)
      if (start < startOfMonth(earliest) || existing.has(month)) continue
      const end = endOfMonth(start)
      const inMonth = txs.filter(t => t.date >= start && t.date <= end)
      const s: PeriodSummary = summarize(inMonth)
      const bal = computeBalances(accounts, txs, end)
      const cats = expensesByCategory(inMonth)
      const budgetPerf = budgets.map(b => ({ category: b.category, budget: b.amount, spent: cats.find(c => c.category === b.category)?.total || 0 }))
      batch.set(ref(u.uid, 'snapshots', month), {
        month, ...s,
        netWorth: netWorth(accounts, bal, holdingsValue).netWorth,
        budgetPerformance: budgetPerf,
        topCategories: cats.slice(0, 5),
        createdAt: serverTimestamp(),
        note: 'Net worth uses current holding values for investments.',
      })
      n++
    }
    if (n) await commit(batch)
    return n
  },
}

// ───────────────────────── legacy migration ─────────────────────────

export interface MigrationRecord {
  version: number
  status: 'completed' | 'failed'
  at: string
  counts: MigrationPlan['counts']
  totalsBefore: MigrationPlan['totalsBefore']
  totalsAfter: MigrationPlan['totalsAfter']
  skipped: MigrationPlan['skipped']
  warnings: string[]
  verifiedCount: number
}

export const migrationService = {
  async status(): Promise<MigrationRecord | null> {
    const u = await currentUser()
    const s = await getDoc(ref(u.uid, 'meta', 'migration'))
    return s.exists() ? (s.data() as MigrationRecord) : null
  },

  async readLegacy() {
    const u = await currentUser()
    const read = async (name: string) => (await getDocs(col(u.uid, name))).docs.map(d => ({ id: d.id, ...d.data() }))
    const [incomes, expenses, savingsGoals, investments, budgets] = await Promise.all(['incomes', 'expenses', 'savingsGoals', 'investments', 'budgets'].map(read))
    return { incomes, expenses, savingsGoals, investments, budgets }
  },

  /** JSON backup of every legacy record (Timestamps serialised to ISO). Step 1 of the migration. */
  backupJSON(legacy: Record<string, any[]>): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'FinanceFlow', schema: 'legacy-v0', data: legacy }, (_k, v) => {
      if (v instanceof Timestamp) return v.toDate().toISOString()
      if (v && typeof v === 'object' && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number') return new Date(v.seconds * 1000).toISOString()
      return v
    }, 2)
  },

  async hasLegacyData(): Promise<boolean> {
    const u = await currentUser()
    const probes = await Promise.all(['incomes', 'expenses', 'savingsGoals', 'investments'].map(n => getDocs(query(col(u.uid, n), qlimit(1)))))
    return probes.some(p => !p.empty)
  },

  plan(legacy: LegacyData, defaultAccountId: string): MigrationPlan {
    return planLegacyMigration(legacy, { defaultAccountId })
  },

  /**
   * Execute (idempotent): write transactions & rules with deterministic ids, adjust the default
   * account balance, read back to verify every planned record exists, then record the result.
   */
  async execute(plan: MigrationPlan, defaultAccountId: string): Promise<MigrationRecord> {
    const u = await currentUser()
    const already = new Set((await getDocs(query(col(u.uid, 'transactions'), where('source', '==', 'migration')))).docs.map(d => d.id))
    const toWrite = plan.transactions.filter(t => !already.has(t.id))
    for (let i = 0; i < toWrite.length; i += 200) {
      const batch = writeBatch(db)
      let delta = 0
      for (const t of toWrite.slice(i, i + 200)) {
        batch.set(ref(u.uid, 'transactions', t.id), { ...clean(t), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        for (const e of balanceEffects(t)) if (e.accountId === defaultAccountId) delta += e.delta
      }
      batch.set(ref(u.uid, 'accounts', defaultAccountId), { balance: increment(Math.round(delta * 100) / 100) }, { merge: true })
      await batch.commit()
    }
    if (plan.rules.length) {
      const batch = writeBatch(db)
      for (const r of plan.rules) batch.set(ref(u.uid, 'recurringRules', r.id), { ...clean(r), createdAt: serverTimestamp() }, { merge: true })
      await batch.commit()
    }
    // verify
    const after = await getDocs(query(col(u.uid, 'transactions'), where('source', '==', 'migration')))
    const ids = new Set(after.docs.map(d => d.id))
    const missing = plan.transactions.filter(t => !ids.has(t.id))
    const v = validateMigrationPlan(plan)
    const rec: MigrationRecord = {
      version: MIGRATION_VERSION,
      status: missing.length || !v.ok ? 'failed' : 'completed',
      at: new Date().toISOString(),
      counts: plan.counts, totalsBefore: plan.totalsBefore, totalsAfter: plan.totalsAfter,
      skipped: plan.skipped, warnings: [...plan.warnings, ...(missing.length ? [`${missing.length} records failed to write`] : [])],
      verifiedCount: plan.transactions.length - missing.length,
    }
    await setDoc(ref(u.uid, 'meta', 'migration'), rec)
    return rec
  },
}
