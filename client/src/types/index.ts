// User types
export interface User {
  id: string
  email: string
  profile: {
    firstName: string
    lastName?: string
    avatar?: string
    phone?: string
    dateOfBirth?: string
    occupation?: string
    monthlyIncome?: number
    bio?: string
  }
  preferences: {
    currency?: string
    language?: string
    dateFormat?: string
    theme?: 'light' | 'dark' | 'system'
    emailNotifications?: boolean
    budgetAlerts?: boolean
    weeklyReport?: boolean
    savingsReminders?: boolean
    notifications?: {
      email: boolean
      push: boolean
      billReminders: boolean
      budgetAlerts: boolean
      savingsReminders: boolean
      weeklyReport: boolean
      monthlyReport: boolean
    }
    dashboardLayout?: string
  }
  financialSetup?: {
    currency: string
    monthlyIncome: number
    riskProfile: 'low' | 'medium' | 'high'
    financialGoals: string[]
  }
  isEmailVerified?: boolean
  createdAt?: string
}

// Income types
export interface Income {
  _id: string
  amount: number
  source: 'salary' | 'freelance' | 'business' | 'passive' | 'investment' | 'rental' | 'bonus' | 'gift' | 'refund' | 'other'
  category: string
  description?: string
  date: string
  isRecurring: boolean
  recurringFrequency?: string
  recurringDetails?: {
    frequency: string
    startDate: string
    endDate?: string
    nextDueDate?: string
    isActive: boolean
  }
  tags?: string[]
  metadata?: {
    payer?: string
    reference?: string
    paymentMethod?: string
  }
  createdAt: string
}

// Expense types
export interface Expense {
  _id: string
  amount: number
  category: ExpenseCategory | string
  subCategory?: string
  description?: string
  notes?: string
  date: string
  isRecurring: boolean
  recurringDetails?: {
    frequency: string
    startDate: string
    endDate?: string
    nextDueDate?: string
    isActive: boolean
  }
  recurringFrequency?: string
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'upi' | 'bank_transfer' | 'wallet' | 'other'
  merchant?: {
    name?: string
    location?: string
  }
  tags?: string[]
  receipt?: {
    filename: string
    url: string
    uploadedAt: string
  }
  isNecessary: boolean
  createdAt: string
}

export type ExpenseCategory = 
  | 'food' | 'transport' | 'bills' | 'entertainment' | 'shopping'
  | 'education' | 'healthcare' | 'housing' | 'insurance' | 'personal'
  | 'travel' | 'gifts' | 'subscriptions' | 'investments' | 'debt_payment' | 'other'

// Savings types
export interface SavingsGoal {
  _id: string
  name: string
  description?: string
  notes?: string
  targetAmount: number
  currentAmount: number
  category: 'emergency_fund' | 'vacation' | 'home' | 'car' | 'education' | 'wedding' | 'retirement' | 'investment' | 'gadget' | 'other'
  icon: string
  color: string
  targetDate: string
  startDate: string
  priority: 'low' | 'medium' | 'high'
  status: 'active' | 'completed' | 'paused' | 'cancelled'
  progressPercentage: number
  remainingAmount: number
  daysRemaining: number
  requiredMonthlySavings: number
  contributions: {
    amount: number
    date: string
    note?: string
    isAutomatic: boolean
  }[]
  createdAt: string
}

// Investment types
export interface Investment {
  _id: string
  name: string
  type: 'stocks' | 'mutual_funds' | 'fixed_deposit' | 'crypto' | 'gold' | 'real_estate' | 'bonds' | 'etf' | 'ppf' | 'nps' | 'sip' | 'other'
  symbol?: string
  platform?: string
  amount: number
  investedAmount: number
  currentValue: number
  units: number
  purchasePrice: number
  currentPrice: number
  purchaseDate: string
  maturityDate?: string
  interestRate?: number
  notes?: string
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
  status: 'active' | 'sold' | 'matured'
  profitLoss: number
  profitLossPercentage: number
  createdAt: string
}

// Budget types
export interface Budget {
  _id: string
  name: string
  category: string
  amount: number
  limit: number
  spent: number
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  alertThreshold?: number
  startDate: string
  endDate: string
  color: string
  icon: string
  isActive: boolean
  remaining: number
  usagePercentage: number
  status: 'healthy' | 'warning' | 'critical' | 'exceeded'
  createdAt: string
}

// Analytics types
export interface AnalyticsOverview {
  period: string
  current: {
    income: number
    expenses: number
    netSavings: number
    savingsRate: number
  }
  previous: {
    income: number
    expenses: number
  }
  changes: {
    income: number
    expenses: number
  }
}

// Notification types
export interface Notification {
  _id: string
  type: string
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  isRead: boolean
  createdAt: string
  data?: any
}

// Category constants
export const EXPENSE_CATEGORIES_DATA: { value: ExpenseCategory; label: string; icon: string; color: string }[] = [
  { value: 'food', label: 'Food & Dining', icon: '🍔', color: '#f97316' },
  { value: 'transport', label: 'Transport', icon: '🚗', color: '#3b82f6' },
  { value: 'bills', label: 'Bills & Utilities', icon: '📄', color: '#8b5cf6' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#ec4899' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️', color: '#14b8a6' },
  { value: 'education', label: 'Education', icon: '📚', color: '#6366f1' },
  { value: 'healthcare', label: 'Healthcare', icon: '🏥', color: '#ef4444' },
  { value: 'housing', label: 'Housing', icon: '🏠', color: '#84cc16' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️', color: '#06b6d4' },
  { value: 'personal', label: 'Personal Care', icon: '💅', color: '#f43f5e' },
  { value: 'travel', label: 'Travel', icon: '✈️', color: '#0ea5e9' },
  { value: 'gifts', label: 'Gifts & Donations', icon: '🎁', color: '#d946ef' },
  { value: 'subscriptions', label: 'Subscriptions', icon: '📱', color: '#a855f7' },
  { value: 'investments', label: 'Investments', icon: '📈', color: '#22c55e' },
  { value: 'debt_payment', label: 'Debt Payment', icon: '💳', color: '#f59e0b' },
  { value: 'other', label: 'Other', icon: '📦', color: '#6b7280' }
]

// Simple string array for dropdowns
export const EXPENSE_CATEGORIES: string[] = EXPENSE_CATEGORIES_DATA.map(cat => cat.label)

export const INCOME_SOURCES: { value: string; label: string; icon: string }[] = [
  { value: 'salary', label: 'Salary', icon: '💼' },
  { value: 'freelance', label: 'Freelance', icon: '💻' },
  { value: 'business', label: 'Business', icon: '🏢' },
  { value: 'passive', label: 'Passive Income', icon: '💰' },
  { value: 'investment', label: 'Investment Returns', icon: '📈' },
  { value: 'rental', label: 'Rental Income', icon: '🏠' },
  { value: 'bonus', label: 'Bonus', icon: '🎉' },
  { value: 'gift', label: 'Gift', icon: '🎁' },
  { value: 'refund', label: 'Refund', icon: '↩️' },
  { value: 'other', label: 'Other', icon: '📦' }
]

// Alias for components that expect INCOME_CATEGORIES
export const INCOME_CATEGORIES = INCOME_SOURCES.map(s => s.value)

export const CURRENCIES = [
  { value: 'LKR', label: 'Sri Lankan Rupee (Rs.)', symbol: 'Rs.' },
  { value: 'INR', label: 'Indian Rupee (₹)', symbol: '₹' },
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { value: 'AUD', label: 'Australian Dollar (A$)', symbol: 'A$' },
  { value: 'CAD', label: 'Canadian Dollar (C$)', symbol: 'C$' },
  { value: 'SGD', label: 'Singapore Dollar (S$)', symbol: 'S$' },
  { value: 'AED', label: 'UAE Dirham (د.إ)', symbol: 'د.إ' }
]
