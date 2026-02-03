import { create } from 'zustand'
import { analyticsService, insightsService } from '../services/firebaseService'

interface Summary {
  totalIncome: number
  totalExpenses: number
  netSavings: number
  investmentValue: number
  savingsRate: number
  savingsGoals: any[]
  avgDailyExpense: number
  expenseByCategory: { _id: string; total: number }[]
  incomeBySource: { _id: string; total: number }[]
  financialHealth?: any
}

interface Cashflow {
  monthlyData: {
    year: number
    month: number
    income: number
    expense: number
  }[]
}

interface DashboardState {
  summary: Summary | null
  cashflow: Cashflow | null
  loading: boolean
  error: string | null
  fetchSummary: () => Promise<void>
  fetchCashflow: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set) => ({
  summary: null,
  cashflow: null,
  loading: false,
  error: null,

  fetchSummary: async () => {
    set({ loading: true, error: null })
    try {
      const [overview, categories, health] = await Promise.all([
        analyticsService.getOverview(),
        analyticsService.getCategoryBreakdown(),
        insightsService.getFinancialHealth()
      ])
      
      set({ 
        summary: {
          totalIncome: overview.totalIncome,
          totalExpenses: overview.totalExpenses,
          netSavings: overview.netSavings,
          investmentValue: overview.investmentValue,
          savingsRate: overview.savingsRate,
          savingsGoals: overview.savingsGoals,
          avgDailyExpense: overview.avgDailyExpense,
          expenseByCategory: categories.expenseByCategory,
          incomeBySource: categories.incomeBySource,
          financialHealth: health
        }, 
        loading: false 
      })
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to load summary',
        loading: false 
      })
    }
  },

  fetchCashflow: async () => {
    try {
      const trends = await analyticsService.getTrends('year')
      set({ 
        cashflow: { 
          monthlyData: trends.monthlyData 
        } 
      })
    } catch (error: any) {
      console.error('Failed to load cashflow:', error)
    }
  }
}))
