import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Token is added via auth store, but we can also check localStorage
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      const { state } = JSON.parse(authStorage)
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state and redirect to login
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// API helper functions
export const apiHelpers = {
  // Income APIs
  income: {
    getAll: (params?: any) => api.get('/income', { params }),
    getSummary: () => api.get('/income/summary'),
    getOne: (id: string) => api.get(`/income/${id}`),
    create: (data: any) => api.post('/income', data),
    update: (id: string, data: any) => api.put(`/income/${id}`, data),
    delete: (id: string) => api.delete(`/income/${id}`)
  },

  // Expense APIs
  expenses: {
    getAll: (params?: any) => api.get('/expenses', { params }),
    getSummary: (period?: string) => api.get('/expenses/summary', { params: { period } }),
    getCategories: () => api.get('/expenses/categories'),
    getOne: (id: string) => api.get(`/expenses/${id}`),
    create: (data: any) => api.post('/expenses', data),
    update: (id: string, data: any) => api.put(`/expenses/${id}`, data),
    delete: (id: string) => api.delete(`/expenses/${id}`)
  },

  // Savings APIs
  savings: {
    getAll: (status?: string) => api.get('/savings', { params: { status } }),
    getSummary: () => api.get('/savings/summary'),
    getOne: (id: string) => api.get(`/savings/${id}`),
    create: (data: any) => api.post('/savings', data),
    update: (id: string, data: any) => api.put(`/savings/${id}`, data),
    contribute: (id: string, data: any) => api.post(`/savings/${id}/contribute`, data),
    delete: (id: string) => api.delete(`/savings/${id}`)
  },

  // Investment APIs
  investments: {
    getAll: (params?: any) => api.get('/investments', { params }),
    getPortfolio: () => api.get('/investments/portfolio'),
    getOne: (id: string) => api.get(`/investments/${id}`),
    create: (data: any) => api.post('/investments', data),
    update: (id: string, data: any) => api.put(`/investments/${id}`, data),
    updatePrice: (id: string, price: number) => api.put(`/investments/${id}/price`, { price }),
    addTransaction: (id: string, data: any) => api.post(`/investments/${id}/transaction`, data),
    delete: (id: string) => api.delete(`/investments/${id}`)
  },

  // Budget APIs
  budgets: {
    getAll: (params?: any) => api.get('/budgets', { params }),
    getCurrent: () => api.get('/budgets/current'),
    getOne: (id: string) => api.get(`/budgets/${id}`),
    create: (data: any) => api.post('/budgets', data),
    createBulk: (data: any) => api.post('/budgets/bulk', data),
    update: (id: string, data: any) => api.put(`/budgets/${id}`, data),
    delete: (id: string) => api.delete(`/budgets/${id}`)
  },

  // Analytics APIs
  analytics: {
    getOverview: (period?: string) => api.get('/analytics/overview', { params: { period } }),
    getIncomeVsExpense: (months?: number) => api.get('/analytics/income-vs-expense', { params: { months } }),
    getExpenseBreakdown: (period?: string) => api.get('/analytics/expense-breakdown', { params: { period } }),
    getSpendingPatterns: () => api.get('/analytics/spending-patterns'),
    getSavingsProgress: () => api.get('/analytics/savings-progress'),
    getInvestmentPerformance: () => api.get('/analytics/investment-performance'),
    getBudgetUtilization: () => api.get('/analytics/budget-utilization')
  },

  // Insights APIs
  insights: {
    getAll: () => api.get('/insights/all'),
    getPredictions: () => api.get('/insights/predictions'),
    getSuggestions: () => api.get('/insights/suggestions'),
    getInvestmentRecs: () => api.get('/insights/investment-recommendations'),
    getBehavioral: () => api.get('/insights/behavioral'),
    getFinancialHealth: () => api.get('/insights/financial-health')
  },

  // Market APIs
  market: {
    getOverview: () => api.get('/market/overview'),
    getSectors: () => api.get('/market/sectors'),
    getSentiment: () => api.get('/market/sentiment'),
    getEducation: (params?: any) => api.get('/market/education', { params }),
    getRecommendations: () => api.get('/market/recommendations')
  },

  // User APIs
  user: {
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data: any) => api.put('/user/profile', data),
    updateFinancialSetup: (data: any) => api.put('/user/financial-setup', data),
    updatePreferences: (data: any) => api.put('/user/preferences', data),
    getDashboardSummary: () => api.get('/user/dashboard-summary')
  }
}
