import type { TransactionType } from './types'

export interface CategoryDef {
  id: string
  label: string
  icon: string
  color: string
  essential?: boolean
  subcategories?: string[]
}

export const EXPENSE_CATEGORY_DEFS: CategoryDef[] = [
  { id: 'food_dining', label: 'Food & Dining', icon: '🍔', color: '#f97316', subcategories: ['Restaurants', 'Takeaway', 'Coffee', 'Snacks'] },
  { id: 'groceries', label: 'Groceries', icon: '🛒', color: '#84cc16', essential: true },
  { id: 'transport', label: 'Transport', icon: '🚌', color: '#3b82f6', essential: true, subcategories: ['Bus/Train', 'Taxi', 'Parking', 'Vehicle Repair', 'Vehicle Service'] },
  { id: 'fuel', label: 'Fuel', icon: '⛽', color: '#0ea5e9', essential: true },
  { id: 'housing', label: 'Housing', icon: '🏠', color: '#22c55e', essential: true, subcategories: ['Rent', 'Mortgage', 'Maintenance'] },
  { id: 'utilities', label: 'Utilities', icon: '💡', color: '#8b5cf6', essential: true, subcategories: ['Electricity', 'Water', 'Gas'] },
  { id: 'internet_mobile', label: 'Internet & Mobile', icon: '📶', color: '#6366f1', essential: true },
  { id: 'healthcare', label: 'Healthcare', icon: '🏥', color: '#ef4444', essential: true, subcategories: ['Doctor', 'Pharmacy', 'Hospital'] },
  { id: 'education', label: 'Education', icon: '📚', color: '#4f46e5', essential: true },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#ec4899' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', color: '#14b8a6' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📱', color: '#a855f7' },
  { id: 'travel', label: 'Travel', icon: '✈️', color: '#06b6d4' },
  { id: 'personal_care', label: 'Personal Care', icon: '💅', color: '#f43f5e' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧', color: '#eab308' },
  { id: 'gifts', label: 'Gifts', icon: '🎁', color: '#d946ef' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', color: '#0891b2', essential: true },
  { id: 'taxes', label: 'Taxes', icon: '🧾', color: '#78716c', essential: true },
  { id: 'debt', label: 'Debt', icon: '💳', color: '#f59e0b', essential: true },
  { id: 'emergency', label: 'Emergency', icon: '🚨', color: '#dc2626', essential: true },
  { id: 'other', label: 'Other', icon: '📦', color: '#6b7280' },
]

export const INCOME_CATEGORY_DEFS: CategoryDef[] = [
  { id: 'salary', label: 'Salary', icon: '💼', color: '#10b981' },
  { id: 'freelance', label: 'Freelance', icon: '💻', color: '#3b82f6' },
  { id: 'business', label: 'Business', icon: '🏢', color: '#8b5cf6' },
  { id: 'bonus', label: 'Bonus', icon: '🎉', color: '#f59e0b' },
  { id: 'interest', label: 'Interest', icon: '🏦', color: '#06b6d4' },
  { id: 'dividend', label: 'Dividend', icon: '📈', color: '#22c55e' },
  { id: 'rental', label: 'Rental', icon: '🏠', color: '#84cc16' },
  { id: 'gift', label: 'Gift', icon: '🎁', color: '#d946ef' },
  { id: 'other_income', label: 'Other', icon: '📦', color: '#6b7280' },
]

export const INVESTMENT_CATEGORY_DEFS: CategoryDef[] = [
  { id: 'stocks', label: 'Stocks', icon: '📈', color: '#22c55e' },
  { id: 'fixed_deposit', label: 'Fixed Deposit', icon: '🏦', color: '#0ea5e9' },
  { id: 'bonds', label: 'Bonds', icon: '📜', color: '#64748b' },
  { id: 'mutual_funds', label: 'Mutual Funds', icon: '📊', color: '#8b5cf6' },
  { id: 'etf', label: 'ETFs', icon: '🧺', color: '#6366f1' },
  { id: 'gold', label: 'Gold', icon: '🪙', color: '#eab308' },
  { id: 'crypto', label: 'Crypto', icon: '₿', color: '#f97316' },
  { id: 'real_estate', label: 'Real Estate', icon: '🏘️', color: '#84cc16' },
  { id: 'other_investment', label: 'Other', icon: '📦', color: '#6b7280' },
]

export const SAVINGS_CATEGORY = { id: 'savings', label: 'Savings', icon: '🐷', color: '#10b981' }
export const TRANSFER_CATEGORY = { id: 'transfer', label: 'Transfer', icon: '🔁', color: '#64748b' }
export const ADJUSTMENT_CATEGORY = { id: 'adjustment', label: 'Adjustment', icon: '⚖️', color: '#64748b' }

const ALL = [
  ...EXPENSE_CATEGORY_DEFS, ...INCOME_CATEGORY_DEFS, ...INVESTMENT_CATEGORY_DEFS,
  SAVINGS_CATEGORY, TRANSFER_CATEGORY, ADJUSTMENT_CATEGORY,
] as CategoryDef[]

// ───────── User-defined categories ("Other → type your own") ─────────
// Ids are prefixed by kind so they never clash with defaults:  cus_* expense · inc_* income · inv_* investment
let CUSTOM: CategoryDef[] = []
export function registerCustomCategories(list: CategoryDef[] | undefined) { CUSTOM = Array.isArray(list) ? list.filter(c => c && c.id && c.label) : [] }
export function getCustomCategories() { return CUSTOM }

export type CategoryKind = 'expense' | 'income' | 'investment'
export function kindForType(type: TransactionType): CategoryKind | null {
  if (type === 'income') return 'income'
  if (type === 'expense' || type === 'refund' || type === 'reimbursement') return 'expense'
  if (type === 'investment' || type === 'withdrawal') return 'investment'
  return null
}
const PREFIX: Record<CategoryKind, string> = { expense: 'cus_', income: 'inc_', investment: 'inv_' }
const PALETTE = ['#0ea5e9', '#f97316', '#a855f7', '#14b8a6', '#e11d48', '#84cc16', '#6366f1', '#eab308']

/** Build a custom category from free text (does not persist — caller saves it to settings). */
export function makeCustomCategory(label: string, kind: CategoryKind, existing: CategoryDef[] = CUSTOM): CategoryDef {
  const clean = label.trim().replace(/\s+/g, ' ').slice(0, 40)
  const all = [...EXPENSE_CATEGORY_DEFS, ...INCOME_CATEGORY_DEFS, ...INVESTMENT_CATEGORY_DEFS, ...existing]
  const same = all.find(c => c.label.toLowerCase() === clean.toLowerCase() && (c.id.startsWith(PREFIX[kind]) || categoriesForType(kind === 'expense' ? 'expense' : kind === 'income' ? 'income' : 'investment', []).some(d => d.id === c.id)))
  if (same) return same
  const slug = clean.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom'
  let id = PREFIX[kind] + slug, n = 2
  while (all.some(c => c.id === id)) id = `${PREFIX[kind]}${slug}_${n++}`
  return { id, label: clean, icon: '🏷️', color: PALETTE[existing.length % PALETTE.length] }
}

export function categoriesForType(type: TransactionType, custom: CategoryDef[] = CUSTOM): CategoryDef[] {
  switch (type) {
    case 'income': return [...INCOME_CATEGORY_DEFS, ...custom.filter(c => c.id.startsWith('inc_'))]
    case 'expense':
    case 'refund':
    case 'reimbursement': return [...EXPENSE_CATEGORY_DEFS, ...custom.filter(c => c.id.startsWith('cus_'))]
    case 'investment':
    case 'withdrawal': return [...INVESTMENT_CATEGORY_DEFS, ...custom.filter(c => c.id.startsWith('inv_'))]
    case 'savings_contribution':
    case 'savings_withdrawal': return [SAVINGS_CATEGORY]
    case 'transfer': return [TRANSFER_CATEGORY]
    case 'adjustment': return [ADJUSTMENT_CATEGORY]
  }
}

export function getCategory(id: string | undefined): CategoryDef {
  return ALL.find(c => c.id === id) || CUSTOM.find(c => c.id === id) || { id: id || 'other', label: humanize(id || 'Other'), icon: '📦', color: '#6b7280' }
}

export function categoryLabel(id: string | undefined): string {
  return getCategory(id).label
}

export function isEssentialCategory(id: string | undefined): boolean {
  return !!EXPENSE_CATEGORY_DEFS.find(c => c.id === id)?.essential
}

function humanize(s: string) {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Map legacy category values (old labels / slugs from the pre-upgrade app,
 * the Express models and the Postgres schema) onto the new category ids.
 */
const LEGACY_EXPENSE_MAP: Record<string, string> = {
  'food & dining': 'food_dining', food: 'food_dining', dining: 'food_dining', restaurant: 'food_dining',
  groceries: 'groceries', grocery: 'groceries',
  transport: 'transport', transportation: 'transport', travel_local: 'transport',
  fuel: 'fuel', petrol: 'fuel',
  'bills & utilities': 'utilities', bills: 'utilities', utilities: 'utilities', electricity: 'utilities',
  housing: 'housing', rent: 'housing',
  healthcare: 'healthcare', health: 'healthcare', medical: 'healthcare',
  education: 'education',
  entertainment: 'entertainment',
  shopping: 'shopping',
  subscriptions: 'subscriptions', subscription: 'subscriptions',
  travel: 'travel',
  'personal care': 'personal_care', personal: 'personal_care',
  'gifts & donations': 'gifts', gifts: 'gifts', gift: 'gifts',
  insurance: 'insurance',
  taxes: 'taxes', tax: 'taxes',
  'debt payment': 'debt', debt_payment: 'debt', debt: 'debt',
  emergency: 'emergency',
  family: 'family',
  investments: 'other', // legacy "Investments" expense category → kept as expense, flagged in migration report
  other: 'other',
}

const LEGACY_INCOME_MAP: Record<string, string> = {
  salary: 'salary', freelance: 'freelance', business: 'business', bonus: 'bonus',
  interest: 'interest', dividend: 'dividend', dividends: 'dividend',
  passive: 'other_income', investment: 'dividend', 'investment returns': 'dividend',
  rental: 'rental', 'rental income': 'rental', gift: 'gift', refund: 'other_income', other: 'other_income',
}

export function mapLegacyExpenseCategory(raw: unknown): string {
  const k = String(raw ?? '').trim().toLowerCase()
  if (!k) return 'other'
  if (EXPENSE_CATEGORY_DEFS.some(c => c.id === k) || k.startsWith('cus_')) return k
  return LEGACY_EXPENSE_MAP[k] || 'other'
}

export function mapLegacyIncomeCategory(raw: unknown): string {
  const k = String(raw ?? '').trim().toLowerCase()
  if (!k) return 'other_income'
  if (INCOME_CATEGORY_DEFS.some(c => c.id === k)) return k
  return LEGACY_INCOME_MAP[k] || 'other_income'
}

export function mapLegacyInvestmentType(raw: unknown): string {
  const k = String(raw ?? '').trim().toLowerCase()
  const m: Record<string, string> = {
    stocks: 'stocks', stock: 'stocks', mutual_funds: 'mutual_funds', sip: 'mutual_funds',
    fixed_deposit: 'fixed_deposit', fd: 'fixed_deposit', crypto: 'crypto', gold: 'gold',
    real_estate: 'real_estate', bonds: 'bonds', etf: 'etf', ppf: 'other_investment', nps: 'other_investment',
  }
  return m[k] || 'other_investment'
}
