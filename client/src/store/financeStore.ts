import { create } from 'zustand'
import { useEffect, useMemo, useState } from 'react'
import type { Unsubscribe } from 'firebase/firestore'
import {
  accountService, recurringService, settingsService, transactionService, snapshotService, migrationService,
  DEFAULT_SETTINGS, type PlanningSettings, type MigrationRecord,
} from '../services/financeService'
import { budgetService, investmentService, savingsService } from '../services/firebaseService'
import type { Account, RecurringRule, Transaction, PeriodRange } from '../lib/finance'
import { addMonths, startOfMonth, todayKey, computeBalances, mapLegacyExpenseCategory, registerCustomCategories, normalizeToBase } from '../lib/finance'
import { setDisplayCurrency } from '../utils/currency'

/** Rolling live window: 13 full months back. Older periods are fetched on demand. */
export const historyStart = () => addMonths(startOfMonth(todayKey()), -13, 1)

export interface Holding { id: string; name: string; type: string; amount: number; currentValue: number; purchaseDate?: any; riskLevel?: string; status?: string; [k: string]: any }
export interface Goal { id: string; name: string; targetAmount: number; currentAmount: number; targetDate?: any; category?: string; status?: string; [k: string]: any }
export interface BudgetDoc { id: string; name?: string; category: string; amount: number; period?: string; [k: string]: any }

interface FinanceState {
  uid: string | null
  ready: { txs: boolean; accounts: boolean; rules: boolean }
  transactions: Transaction[]
  windowStart: string
  pendingWrites: number
  fromCache: boolean
  accounts: Account[]
  rules: RecurringRule[]
  settings: PlanningSettings
  holdings: Holding[]
  goals: Goal[]
  budgets: BudgetDoc[]
  migration: MigrationRecord | null
  needsMigration: boolean
  error: string | null
  init: (uid: string) => void
  stop: () => void
  refreshModules: () => Promise<void>
  checkMigration: () => Promise<void>
}

let unsubs: Unsubscribe[] = []
let bootstrapped = { defaults: false, generated: false, snapshots: false }

export const useFinanceStore = create<FinanceState>((set, get) => ({
  uid: null,
  ready: { txs: false, accounts: false, rules: false },
  transactions: [],
  windowStart: historyStart(),
  pendingWrites: 0,
  fromCache: false,
  accounts: [],
  rules: [],
  settings: DEFAULT_SETTINGS,
  holdings: [],
  goals: [],
  budgets: [],
  migration: null,
  needsMigration: false,
  error: null,

  init: (uid) => {
    if (get().uid === uid) return
    get().stop()
    bootstrapped = { defaults: false, generated: false, snapshots: false }
    const windowStart = historyStart()
    set({ uid, windowStart, ready: { txs: false, accounts: false, rules: false } })

    unsubs.push(transactionService.subscribeRange(uid, windowStart, (raw, meta) => {
      const transactions = raw.map(normalizeToBase)
      set(s => ({ transactions, pendingWrites: meta.pending, fromCache: meta.fromCache, ready: { ...s.ready, txs: true } }))
      maybeSnapshots()
    }, e => set({ error: e.message })))

    unsubs.push(accountService.subscribe(uid, accounts => {
      set(s => ({ accounts, ready: { ...s.ready, accounts: true } }))
      if (!bootstrapped.defaults && !accounts.length) {
        bootstrapped.defaults = true
        accountService.ensureDefaults(accounts).catch(console.error)
      }
      maybeGenerate()
    }))

    unsubs.push(recurringService.subscribe(uid, rules => {
      set(s => ({ rules, ready: { ...s.ready, rules: true } }))
      maybeGenerate()
    }))

    unsubs.push(settingsService.subscribe(uid, settings => {
      registerCustomCategories(settings.customCategories)
      setDisplayCurrency(settings.baseCurrency || 'LKR')
      set({ settings })
    }))

    get().refreshModules()
    get().checkMigration()

    const onOnline = () => { bootstrapped.generated = false; maybeGenerate() }
    window.addEventListener('online', onOnline)
    unsubs.push(() => window.removeEventListener('online', onOnline))
  },

  stop: () => {
    unsubs.forEach(u => u())
    unsubs = []
    set({ uid: null, transactions: [], accounts: [], rules: [], holdings: [], goals: [], budgets: [], migration: null, needsMigration: false })
  },

  refreshModules: async () => {
    try {
      const [holdings, goals, budgets] = await Promise.all([investmentService.getAll(), savingsService.getAll(), budgetService.getAll()])
      set({
        holdings: holdings as Holding[],
        goals: goals as Goal[],
        // Budgets are normalised to a MONTHLY amount (legacy docs stored `limit` + a period).
        budgets: (budgets as any[]).map(b => {
          const raw = Number(b.limit ?? b.amount) || 0
          const perMonth = b.period === 'yearly' ? raw / 12 : b.period === 'quarterly' ? raw / 3 : b.period === 'weekly' ? raw * 4.345 : raw
          return { ...b, category: mapLegacyExpenseCategory(b.category), amount: Math.round(perMonth) }
        }),
      })
    } catch (e: any) { console.error(e) }
  },

  checkMigration: async () => {
    try {
      const rec = await migrationService.status()
      if (rec?.status === 'completed') return set({ migration: rec, needsMigration: false })
      const has = await migrationService.hasLegacyData()
      set({ migration: rec, needsMigration: has })
    } catch (e) { console.error(e) }
  },
}))

function maybeGenerate() {
  const s = useFinanceStore.getState()
  if (bootstrapped.generated || !s.ready.rules || !s.ready.accounts || !s.rules.length) return
  bootstrapped.generated = true
  recurringService.generateDue(s.rules, s.accounts).then(n => { if (n) console.info(`[recurring] generated ${n} transaction(s)`) }).catch(e => { console.error(e); bootstrapped.generated = false })
}

function maybeSnapshots() {
  const s = useFinanceStore.getState()
  if (bootstrapped.snapshots || !s.ready.accounts || !s.transactions.length) return
  bootstrapped.snapshots = true
  const hv = s.holdings.filter(h => h.status !== 'sold').reduce((a, h) => a + (Number(h.currentValue) || Number(h.amount) || 0), 0)
  snapshotService.ensureSnapshots(s.transactions, s.accounts, hv, s.budgets).catch(console.error)
}

// ───────────────────────── hooks ─────────────────────────

/**
 * Transactions for a period. Served from the live window when possible (instant, offline-capable),
 * otherwise a single date-range query for exactly that period.
 */
export function usePeriodTransactions(r: PeriodRange): { txs: Transaction[]; loading: boolean } {
  const { transactions, windowStart, ready } = useFinanceStore()
  const inWindow = r.start >= windowStart
  const [extra, setExtra] = useState<{ key: string; txs: Transaction[] } | null>(null)
  const key = `${r.start}_${r.end}`
  useEffect(() => {
    if (inWindow) return
    let alive = true
    transactionService.listRange(r).then(txs => alive && setExtra({ key, txs: txs.map(normalizeToBase) })).catch(console.error)
    return () => { alive = false }
  }, [key, inWindow])
  const txs = useMemo(() => inWindow ? transactions.filter(t => t.date >= r.start && t.date <= r.end) : (extra?.key === key ? extra.txs : []), [transactions, inWindow, extra, key])
  return { txs, loading: inWindow ? !ready.txs : extra?.key !== key }
}

export function useBalances() {
  const { accounts, transactions } = useFinanceStore()
  // Cached balances are authoritative for "now"; computed balances are used for historical views.
  return useMemo(() => {
    const cached: Record<string, number> = {}
    for (const a of accounts) cached[a.id] = Number(a.balance ?? a.openingBalance) || 0
    return cached
  }, [accounts, transactions])
}

export { computeBalances }

// Dev/E2E inspection hook (stripped from production builds by the DEV guard)
if (import.meta.env.DEV && typeof window !== 'undefined') (window as any).__financeStore = useFinanceStore
