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
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth'
import { db, auth } from '../config/firebase'

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

  // Login with Google
  async loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    // Check if user profile exists, if not create one
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
    }

    return user
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

// Generic Firestore CRUD operations
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
    const docRef = doc(db, collectionName, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now()
    })
    return { id, ...data }
  },

  async delete(id: string) {
    const docRef = doc(db, collectionName, id)
    await deleteDoc(docRef)
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

// Analytics Service
export const analyticsService = {
  async getOverview() {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    // Get all incomes
    const incomeQuery = query(collection(db, 'incomes'), where('userId', '==', user.uid))
    const incomeSnapshot = await getDocs(incomeQuery)
    const incomes = incomeSnapshot.docs.map(doc => doc.data())
    const totalIncome = incomes.reduce((sum, inc) => sum + (inc.amount || 0), 0)

    // Get all expenses
    const expenseQuery = query(collection(db, 'expenses'), where('userId', '==', user.uid))
    const expenseSnapshot = await getDocs(expenseQuery)
    const expenses = expenseSnapshot.docs.map(doc => doc.data())
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)

    // Get investments
    const investmentQuery = query(collection(db, 'investments'), where('userId', '==', user.uid))
    const investmentSnapshot = await getDocs(investmentQuery)
    const investments = investmentSnapshot.docs.map(doc => doc.data())
    const investmentValue = investments.reduce((sum, inv) => sum + (inv.currentValue || inv.amount || 0), 0)

    // Get savings goals
    const savingsQuery = query(collection(db, 'savingsGoals'), where('userId', '==', user.uid))
    const savingsSnapshot = await getDocs(savingsQuery)
    const savingsGoals = savingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    const netSavings = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

    return {
      totalIncome,
      totalExpenses,
      netSavings,
      investmentValue,
      savingsRate,
      savingsGoals,
      avgDailyExpense: expenses.length > 0 ? totalExpenses / 30 : 0
    }
  },

  async getTrends(period: 'week' | 'month' | 'year' = 'month') {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    const now = new Date()
    let months = 6

    if (period === 'week') months = 1
    if (period === 'year') months = 12

    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1)

    // Get incomes
    const incomeQuery = query(
      collection(db, 'incomes'),
      where('userId', '==', user.uid),
      where('date', '>=', Timestamp.fromDate(startDate))
    )
    const incomeSnapshot = await getDocs(incomeQuery)
    const incomes = incomeSnapshot.docs.map(doc => doc.data())

    // Get expenses
    const expenseQuery = query(
      collection(db, 'expenses'),
      where('userId', '==', user.uid),
      where('date', '>=', Timestamp.fromDate(startDate))
    )
    const expenseSnapshot = await getDocs(expenseQuery)
    const expenses = expenseSnapshot.docs.map(doc => doc.data())

    // Group by month
    const monthlyData: Record<string, { income: number; expense: number }> = {}

    incomes.forEach(inc => {
      const date = inc.date?.toDate ? inc.date.toDate() : new Date(inc.date)
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`
      if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0 }
      monthlyData[key].income += inc.amount || 0
    })

    expenses.forEach(exp => {
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
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    // Get expense totals by category
    const expenseQuery = query(collection(db, 'expenses'), where('userId', '==', user.uid))
    const expenseSnapshot = await getDocs(expenseQuery)
    const expenses = expenseSnapshot.docs.map(doc => doc.data())

    const expenseByCategory: Record<string, number> = {}
    expenses.forEach(exp => {
      const category = exp.category || 'Other'
      expenseByCategory[category] = (expenseByCategory[category] || 0) + (exp.amount || 0)
    })

    // Get income totals by source
    const incomeQuery = query(collection(db, 'incomes'), where('userId', '==', user.uid))
    const incomeSnapshot = await getDocs(incomeQuery)
    const incomes = incomeSnapshot.docs.map(doc => doc.data())

    const incomeBySource: Record<string, number> = {}
    incomes.forEach(inc => {
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
