import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth'
import { db, auth } from '../config/firebase'

// ======= CACHING LAYER =======
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<any>>()
const CACHE_TTL = 60000 // 1 minute cache
const SHORT_CACHE_TTL = 30000 // 30 seconds for frequently changing data

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data
  }
  cache.delete(key)
  return null
}

function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): T {
  cache.set(key, { data, timestamp: Date.now() })
  return data
}

export function clearCache(prefix?: string) {
  if (prefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key)
    }
  } else {
    cache.clear()
  }
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider()

// Auth Services
export const authService = {
  // Register new user
  async register(email: string, password: string, firstName: string, lastName: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Update display name
    await updateProfile(user, {
      displayName: `${firstName} ${lastName}`
    })

    // Create user profile in Firestore
    await addDoc(collection(db, 'users'), {
      uid: user.uid,
      email: user.email,
      profile: {
        firstName,
        lastName,
        phone: '',
        dateOfBirth: null,
        occupation: '',
        monthlyIncome: 0
      },
      preferences: {
        currency: 'INR',
        language: 'en',
        dateFormat: 'DD/MM/YYYY',
        emailNotifications: true,
        budgetAlerts: true,
        weeklyReport: true
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })

    return user
  },

  // Login with email/password
  async login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return userCredential.user
  },

  // Login with Google (try popup first, fallback to redirect)
  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      await this._ensureUserProfile(user)
      return user
    } catch (error: any) {
      // If popup is blocked, try redirect
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, googleProvider)
        return null // Will be handled on redirect return
      }
      throw error
    }
  },

  // Check for redirect result (call on app init)
  async checkRedirectResult() {
    try {
      const result = await getRedirectResult(auth)
      if (result?.user) {
        await this._ensureUserProfile(result.user)
        return result.user
      }
      return null
    } catch (error) {
      console.error('Redirect result error:', error)
      return null
    }
  },

  // Helper to create user profile if needed
  async _ensureUserProfile(user: User) {
    const existingProfile = await this.getUserProfile(user.uid)
    if (!existingProfile) {
      const nameParts = user.displayName?.split(' ') || ['User']
      await addDoc(collection(db, 'users'), {
        uid: user.uid,
        email: user.email,
        profile: {
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          phone: user.phoneNumber || '',
          avatar: user.photoURL || '',
          dateOfBirth: null,
          occupation: '',
          monthlyIncome: 0
        },
        preferences: {
          currency: 'LKR',
          language: 'en',
          dateFormat: 'DD/MM/YYYY',
          emailNotifications: true,
          budgetAlerts: true,
          weeklyReport: true
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
    }
  },

  // Logout
  async logout() {
    await signOut(auth)
  },

  // Get current user
  getCurrentUser(): User | null {
    return auth.currentUser
  },

  // Auth state listener
  onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback)
  },

  // Get user profile from Firestore
  async getUserProfile(uid: string): Promise<{
    id: string
    profile?: { firstName?: string; lastName?: string }
    preferences?: { currency?: string; language?: string; theme?: string }
  } | null> {
    const q = query(collection(db, 'users'), where('uid', '==', uid))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const doc = snapshot.docs[0]
      return { id: doc.id, ...doc.data() } as any
    }
    return null
  },

  // Update user profile
  async updateUserProfile(uid: string, data: any) {
    const q = query(collection(db, 'users'), where('uid', '==', uid))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const docRef = doc(db, 'users', snapshot.docs[0].id)
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
      })
    }
  }
}

// Generic Firestore CRUD operations - clears cache on mutations
const createCRUD = (collectionName: string) => ({
  async create(data: any) {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      userId: user.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    clearCache(`userData_${user.uid}`) // Clear cache after write
    return { id: docRef.id, ...data }
  },

  async getAll(filters?: QueryConstraint[]) {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    const constraints: QueryConstraint[] = [
      where('userId', '==', user.uid),
      ...(filters || [])
    ]

    const q = query(collection(db, collectionName), ...constraints)
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  async getById(id: string) {
    const docRef = doc(db, collectionName, id)
    const snapshot = await getDoc(docRef)
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() }
    }
    return null
  },

  async update(id: string, data: any) {
    const user = auth.currentUser
    const docRef = doc(db, collectionName, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now()
    })
    if (user) clearCache(`userData_${user.uid}`) // Clear cache after write
    return { id, ...data }
  },

  async delete(id: string) {
    const user = auth.currentUser
    const docRef = doc(db, collectionName, id)
    await deleteDoc(docRef)
    if (user) clearCache(`userData_${user.uid}`) // Clear cache after write
    return { id }
  }
})

// Collection Services
export const incomeService = {
  ...createCRUD('incomes'),

  async getByDateRange(startDate: Date, endDate: Date) {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    const q = query(
      collection(db, 'incomes'),
      where('userId', '==', user.uid),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  async getTotalByCategory() {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    const q = query(collection(db, 'incomes'), where('userId', '==', user.uid))
    const snapshot = await getDocs(q)
    const incomes = snapshot.docs.map(doc => doc.data())

    const totals: Record<string, number> = {}
    incomes.forEach(income => {
      const category = income.category || 'Other'
      totals[category] = (totals[category] || 0) + (income.amount || 0)
    })
    return totals
  }
}

export const expenseService = {
  ...createCRUD('expenses'),

  async getByDateRange(startDate: Date, endDate: Date) {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    const q = query(
      collection(db, 'expenses'),
      where('userId', '==', user.uid),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  async getTotalByCategory() {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    const q = query(collection(db, 'expenses'), where('userId', '==', user.uid))
    const snapshot = await getDocs(q)
    const expenses = snapshot.docs.map(doc => doc.data())

    const totals: Record<string, number> = {}
    expenses.forEach(expense => {
      const category = expense.category || 'Other'
      totals[category] = (totals[category] || 0) + (expense.amount || 0)
    })
    return totals
  }
}

export const savingsService = {
  ...createCRUD('savingsGoals'),

  async addContribution(goalId: string, amount: number, notes?: string) {
    const docRef = doc(db, 'savingsGoals', goalId)
    const snapshot = await getDoc(docRef)
    
    if (snapshot.exists()) {
      const data = snapshot.data()
      const currentAmount = data.currentAmount || 0
      const newAmount = currentAmount + amount
      const targetAmount = data.targetAmount || 0

      await updateDoc(docRef, {
        currentAmount: newAmount,
        status: newAmount >= targetAmount ? 'completed' : 'active',
        contributions: [
          ...(data.contributions || []),
          { amount, notes, date: Timestamp.now() }
        ],
        updatedAt: Timestamp.now()
      })
    }
  }
}

export const investmentService = createCRUD('investments')
export const budgetService = {
  ...createCRUD('budgets'),

  async checkBudgetStatus() {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    // Get all budgets
    const budgetQuery = query(collection(db, 'budgets'), where('userId', '==', user.uid))
    const budgetSnapshot = await getDocs(budgetQuery)
    const budgets = budgetSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Get current month expenses
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const expenseQuery = query(
      collection(db, 'expenses'),
      where('userId', '==', user.uid),
      where('date', '>=', Timestamp.fromDate(startOfMonth)),
      where('date', '<=', Timestamp.fromDate(endOfMonth))
    )
    const expenseSnapshot = await getDocs(expenseQuery)
    const expenses = expenseSnapshot.docs.map(doc => doc.data())

    // Calculate spent per category
    const spentByCategory: Record<string, number> = {}
    expenses.forEach(expense => {
      const category = expense.category || 'Other'
      spentByCategory[category] = (spentByCategory[category] || 0) + (expense.amount || 0)
    })

    // Return budgets with spent amount
    return budgets.map((budget: any) => ({
      ...budget,
      spent: spentByCategory[budget.category] || 0
    }))
  }
}

// Analytics Service - OPTIMIZED with caching and parallel queries
export const analyticsService = {
  // Fetch all user data in one batch - reused across methods
  async _fetchAllUserData() {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')
    
    const cacheKey = `userData_${user.uid}`
    const cached = getCached<any>(cacheKey)
    if (cached) return cached

    // Run ALL queries in parallel
    const [incomeSnapshot, expenseSnapshot, investmentSnapshot, savingsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'incomes'), where('userId', '==', user.uid), limit(500))),
      getDocs(query(collection(db, 'expenses'), where('userId', '==', user.uid), limit(500))),
      getDocs(query(collection(db, 'investments'), where('userId', '==', user.uid), limit(100))),
      getDocs(query(collection(db, 'savingsGoals'), where('userId', '==', user.uid), limit(50)))
    ])

    const data = {
      incomes: incomeSnapshot.docs.map(doc => doc.data()),
      expenses: expenseSnapshot.docs.map(doc => doc.data()),
      investments: investmentSnapshot.docs.map(doc => doc.data()),
      savingsGoals: savingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }

    return setCache(cacheKey, data, SHORT_CACHE_TTL)
  },

  async getOverview() {
    const data = await this._fetchAllUserData()
    
    const totalIncome = data.incomes.reduce((sum: number, inc: any) => sum + (inc.amount || 0), 0)
    const totalExpenses = data.expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0)
    const investmentValue = data.investments.reduce((sum: number, inv: any) => sum + (inv.currentValue || inv.amount || 0), 0)
    
    const netSavings = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

    return {
      totalIncome,
      totalExpenses,
      netSavings,
      investmentValue,
      savingsRate,
      savingsGoals: data.savingsGoals,
      avgDailyExpense: data.expenses.length > 0 ? totalExpenses / 30 : 0
    }
  },

  async getTrends(period: 'week' | 'month' | 'year' = 'month') {
    const data = await this._fetchAllUserData()
    
    const now = new Date()
    let months = 6
    if (period === 'week') months = 1
    if (period === 'year') months = 12
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1)

    // Filter locally instead of new queries
    const filteredIncomes = data.incomes.filter((inc: any) => {
      const date = inc.date?.toDate ? inc.date.toDate() : new Date(inc.date)
      return date >= startDate
    })
    const filteredExpenses = data.expenses.filter((exp: any) => {
      const date = exp.date?.toDate ? exp.date.toDate() : new Date(exp.date)
      return date >= startDate
    })

    // Group by month
    const monthlyData: Record<string, { income: number; expense: number }> = {}

    filteredIncomes.forEach((inc: any) => {
      const date = inc.date?.toDate ? inc.date.toDate() : new Date(inc.date)
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`
      if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 }
      monthlyData[key].income += inc.amount || 0
    })

    filteredExpenses.forEach((exp: any) => {
      const date = exp.date?.toDate ? exp.date.toDate() : new Date(exp.date)
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`
      if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 }
      monthlyData[key].expense += exp.amount || 0
    })

    const result = Object.entries(monthlyData).map(([key, value]) => {
      const [year, month] = key.split('-').map(Number)
      return { year, month, ...value }
    }).sort((a, b) => a.year - b.year || a.month - b.month)

    return { monthlyData: result }
  },

  async getCategoryBreakdown() {
    const data = await this._fetchAllUserData()

    const expenseByCategory: Record<string, number> = {}
    data.expenses.forEach((exp: any) => {
      const category = exp.category || 'Other'
      expenseByCategory[category] = (expenseByCategory[category] || 0) + (exp.amount || 0)
    })

    const incomeBySource: Record<string, number> = {}
    data.incomes.forEach((inc: any) => {
      const source = inc.category || inc.source || 'Other'
      incomeBySource[source] = (incomeBySource[source] || 0) + (inc.amount || 0)
    })

    return {
      expenseByCategory: Object.entries(expenseByCategory).map(([_id, total]) => ({ _id, total })),
      incomeBySource: Object.entries(incomeBySource).map(([_id, total]) => ({ _id, total }))
    }
  }
}

// Insights Service (AI-like analysis)
export const insightsService = {
  async getFinancialHealth() {
    const overview = await analyticsService.getOverview()

    let score = 50 // Base score

    // Savings rate impact (0-30 points)
    if (overview.savingsRate >= 30) score += 30
    else if (overview.savingsRate >= 20) score += 25
    else if (overview.savingsRate >= 10) score += 15
    else if (overview.savingsRate > 0) score += 10

    // Investment diversification (0-20 points)
    if (overview.investmentValue > 0) {
      score += Math.min(20, overview.investmentValue / overview.totalIncome * 20)
    }

    return {
      score: Math.min(100, Math.round(score)),
      savingsRate: overview.savingsRate,
      netWorth: overview.netSavings + overview.investmentValue
    }
  },

  async getSavingSuggestions() {
    const categories = await analyticsService.getCategoryBreakdown()
    const suggestions: any[] = []

    // Analyze spending patterns
    const expenseCategories = categories.expenseByCategory || []
    const total = expenseCategories.reduce((sum: number, cat: any) => sum + cat.total, 0)

    expenseCategories.forEach((cat: any) => {
      const percentage = (cat.total / total) * 100
      if (percentage > 30 && cat._id !== 'Housing') {
        suggestions.push({
          title: `Reduce ${cat._id} spending`,
          description: `${cat._id} accounts for ${percentage.toFixed(1)}% of your expenses`,
          potentialSavings: Math.round(cat.total * 0.2)
        })
      }
    })

    // Default suggestions
    if (suggestions.length === 0) {
      suggestions.push(
        { title: 'Track Daily Expenses', description: 'Monitor small purchases that add up', potentialSavings: 1500 },
        { title: 'Use Cashback Apps', description: 'Earn rewards on regular purchases', potentialSavings: 800 }
      )
    }

    return { suggestions }
  },

  async getInvestmentRecommendations() {
    const overview = await analyticsService.getOverview()
    const recommendations: any[] = []

    if (overview.savingsRate > 20) {
      recommendations.push({
        title: 'Index Funds',
        description: 'Low-cost diversified investment for long-term growth',
        riskLevel: 'medium',
        expectedReturn: '12-15%'
      })
    }

    recommendations.push(
      {
        title: 'PPF Account',
        description: 'Tax-free returns with government backing',
        riskLevel: 'low',
        expectedReturn: '7.1%'
      },
      {
        title: 'Debt Mutual Funds',
        description: 'Stable returns with moderate liquidity',
        riskLevel: 'low',
        expectedReturn: '6-8%'
      }
    )

    return { recommendations }
  },

  async getPredictions() {
    const trends = await analyticsService.getTrends('year')
    const monthlyData = trends.monthlyData || []

    if (monthlyData.length < 3) {
      return { predictedIncome: 0, predictedExpenses: 0, predictedSavings: 0 }
    }

    // Simple average-based prediction
    const recentMonths = monthlyData.slice(-3)
    const avgIncome = recentMonths.reduce((sum, m) => sum + m.income, 0) / recentMonths.length
    const avgExpense = recentMonths.reduce((sum, m) => sum + m.expense, 0) / recentMonths.length

    return {
      predictedIncome: Math.round(avgIncome),
      predictedExpenses: Math.round(avgExpense),
      predictedSavings: Math.round(avgIncome - avgExpense)
    }
  }
}

// Market Service (static data for now)
export const marketService = {
  async getOverview() {
    return {
      indices: [
        { name: 'NIFTY 50', value: 22147.50, change: 156.30, changePercent: 0.71 },
        { name: 'SENSEX', value: 72831.94, change: 502.45, changePercent: 0.69 },
        { name: 'NIFTY BANK', value: 46892.30, change: -123.45, changePercent: -0.26 },
        { name: 'GOLD', value: 62450.00, change: 350.00, changePercent: 0.56 }
      ],
      news: [
        { title: 'RBI Keeps Repo Rate Unchanged', source: 'Economic Times', url: '#', publishedAt: new Date().toISOString() }
      ]
    }
  }
}
