/**
 * Core financial domain model — transaction-centric.
 *
 * Principle: "Track actual money first. Plan future money second."
 *  - Transaction    = an actual financial event (reality)
 *  - RecurringRule  = a template that MAY generate future transactions (plan)
 *  - Budget         = a spending plan
 *  - Forecast       = an estimate
 * These are never mixed.
 */

export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'investment'
  | 'withdrawal'            // money taken out of an investment back to cash
  | 'savings_contribution'
  | 'savings_withdrawal'
  | 'refund'                // contra-expense: reduces net expenses
  | 'reimbursement'         // contra-expense: reduces net expenses
  | 'adjustment'            // balance correction, never income/expense

export const TRANSACTION_TYPES: TransactionType[] = [
  'income', 'expense', 'transfer', 'investment', 'withdrawal',
  'savings_contribution', 'savings_withdrawal', 'refund', 'reimbursement', 'adjustment'
]

export type TransactionSource = 'manual' | 'voice' | 'imported' | 'api' | 'bank_sync' | 'ai' | 'recurring' | 'migration'
export type TransactionStatus = 'cleared' | 'pending' | 'void'

export type ExpenseNature = 'fixed' | 'variable'
export type ExpenseKind = 'regular' | 'one_time' | 'unexpected' | 'emergency'

export interface Transaction {
  id: string
  type: TransactionType
  /** Always a positive number. Direction comes from `type`. */
  amount: number
  currency: string
  /** Local calendar date, YYYY-MM-DD (source of truth for period grouping). */
  date: string
  /** Optional local time HH:mm */
  time?: string
  category: string
  subcategory?: string
  description?: string
  merchant?: string
  accountId?: string
  /** Destination account for transfers / contributions / investments. */
  toAccountId?: string
  paymentMethod?: string
  tags?: string[]
  notes?: string
  receiptUrl?: string
  recurrenceId?: string
  goalId?: string
  investmentId?: string
  isEssential?: boolean
  nature?: ExpenseNature
  kind?: ExpenseKind
  status: TransactionStatus
  source: TransactionSource
  legacy?: { collection: string; id: string }
  createdAt?: string
  updatedAt?: string
}

export type AccountType =
  | 'cash' | 'bank' | 'savings' | 'credit_card' | 'debit_card' | 'ewallet'
  | 'investment' | 'fixed_deposit' | 'loan' | 'other_asset' | 'property'

export interface Account {
  id: string
  name: string
  type: AccountType
  currency: string
  openingBalance: number
  openingDate?: string
  /** Cached running balance (maintained incrementally; can be recomputed). */
  balance?: number
  archived?: boolean
  /** Minimum emergency reserve to keep in this account (optional). */
  createdAt?: string
}

export const ACCOUNT_TYPES: { value: AccountType; label: string; liability?: boolean; spendable?: boolean }[] = [
  { value: 'cash', label: 'Cash', spendable: true },
  { value: 'bank', label: 'Bank Account', spendable: true },
  { value: 'debit_card', label: 'Debit Card', spendable: true },
  { value: 'ewallet', label: 'E-Wallet', spendable: true },
  { value: 'credit_card', label: 'Credit Card', liability: true, spendable: true },
  { value: 'savings', label: 'Savings Account' },
  { value: 'fixed_deposit', label: 'Fixed Deposit' },
  { value: 'investment', label: 'Investment Account' },
  { value: 'property', label: 'Property' },
  { value: 'other_asset', label: 'Other Asset' },
  { value: 'loan', label: 'Loan', liability: true },
]

export const isLiabilityAccount = (t: AccountType) => !!ACCOUNT_TYPES.find(a => a.value === t)?.liability
export const isSpendableAccount = (t: AccountType) => !!ACCOUNT_TYPES.find(a => a.value === t)?.spendable

export type Frequency =
  | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom'

export interface RecurringRule {
  id: string
  type: TransactionType
  amount: number
  currency: string
  category: string
  subcategory?: string
  description: string
  merchant?: string
  accountId?: string
  toAccountId?: string
  frequency: Frequency
  /** For 'custom': repeat every `interval` units of `customUnit`. */
  interval?: number
  customUnit?: 'day' | 'week' | 'month' | 'year'
  startDate: string
  endDate?: string
  /** If true, occurrences up to today are written as real transactions automatically. */
  autoGenerate: boolean
  reminder?: boolean
  /** Bills are essential obligations surfaced in "Upcoming Bills" and safe-to-spend. */
  isBill?: boolean
  isEssential?: boolean
  /** Variable-amount recurring item (e.g. electricity) — amount is an estimate. */
  variableAmount?: boolean
  skippedDates?: string[]
  /** Last occurrence date already materialised (YYYY-MM-DD). */
  lastGeneratedDate?: string
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface PeriodRange {
  start: string // inclusive YYYY-MM-DD
  end: string   // inclusive YYYY-MM-DD
}

export interface PeriodSummary {
  income: number
  expenses: number          // gross expenses
  refunds: number           // refunds + reimbursements
  netExpenses: number       // expenses - refunds
  savings: number           // contributions - withdrawals
  investments: number       // invested - withdrawn
  transfers: number         // informational only — never income/expense
  netCashFlow: number       // income - netExpenses
  availableCashChange: number // netCashFlow - savings - investments
  savingsRate: number       // (savings + investments) / income * 100
  surplusRate: number       // netCashFlow / income * 100
  count: number
}
