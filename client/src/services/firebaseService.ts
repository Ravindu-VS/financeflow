import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
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

// ======= AUTH HELPER =======
// Wait for auth to be ready (resolves with current user or null)
function waitForAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    const user = auth.currentUser
    if (user) {
      resolve(user)
      return
    }
    // If no user yet, wait for auth state to initialize
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
    // Timeout after 2 seconds
    setTimeout(() => {
      unsubscribe()
      resolve(auth.currentUser)
    }, 2000)
  })
}

// Get current user with auth ready check
async function getCurrentUserAsync(): Promise<User> {
  const user = await waitForAuth()
  if (!user) throw new Error('Not authenticated')
  return user
}

// ======= CACHING LAYER =======
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const cache = new Map<string, CacheEntry<any>>()
const CACHE_TTL = 60000 // 1 minute cache
const SHORT_CACHE_TTL = 30000 // 30 seconds for frequently changing data

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < entry.ttl) {
    return entry.data
  }
  cache.delete(key)
  return null
}

function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): T {
  cache.set(key, { data, timestamp: Date.now(), ttl })
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

    // Create user profile in Firestore using UID as document ID
    await setDoc(doc(db, 'users', user.uid), {
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

    return user
  },

  // Login with email/password
  async login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return userCredential.user
  },

  // Login with Google via popup
  async loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  },

  // Helper to create user profile if needed
  async _ensureUserProfile(user: User) {
    const existingProfile = await this.getUserProfile(user.uid)
    if (!existingProfile) {
      const nameParts = user.displayName?.split(' ') || ['User']
      await setDoc(doc(db, 'users', user.uid), {
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
    const docRef = doc(db, 'users', uid)
    const snapshot = await getDoc(docRef)
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as any
    }
    return null
  },

  // Update user profile
  async updateUserProfile(uid: string, data: any) {
    const docRef = doc(db, 'users', uid)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now()
    })
  }
}

// Helper to get user subcollection reference: users/{userId}/{collectionName}
function userCollection(userId: string, collectionName: string) {
  return collection(db, 'users', userId, collectionName)
}

// Generic Firestore CRUD operations using user subcollections
const createCRUD = (collectionName: string) => ({
  async create(data: any) {
    const user = await getCurrentUserAsync()
    const colRef = userCollection(user.uid, collectionName)

    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    clearCache(`userData_${user.uid}`)
    return { id: docRef.id, ...data }
  },

  async getAll(filters?: QueryConstraint[]) {
    const user = await getCurrentUserAsync()
    const colRef = userCollection(user.uid, collectionName)

    const constraints: QueryConstraint[] = [...(filters || [])]
    const q = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef)
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  async getById(id: string) {
    const user = await getCurrentUserAsync()
    const docRef = doc(db, 'users', user.uid, collectionName, id)
    const snapshot = await getDoc(docRef)
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() }
    }
    return null
  },

  async update(id: string, data: any) {
    const user = await getCurrentUserAsync()
    const docRef = doc(db, 'users', user.uid, collectionName, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now()
    })
    clearCache(`userData_${user.uid}`)
    return { id, ...data }
  },

  async delete(id: string) {
    const user = await getCurrentUserAsync()
    const docRef = doc(db, 'users', user.uid, collectionName, id)
    await deleteDoc(docRef)
    clearCache(`userData_${user.uid}`)
    return { id }
  }
})

// Collection Services
// incomeService / expenseService are LEGACY (pre-upgrade collections). New entries are written to
// `transactions` via financeService; these remain for reading old data only.
export const incomeService = {
  ...createCRUD('incomes'),

  async getByDateRange(startDate: Date, endDate: Date) {
    const user = await getCurrentUserAsync()
    const colRef = userCollection(user.uid, 'incomes')

    const q = query(
      colRef,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  async getTotalByCategory() {
    const user = await getCurrentUserAsync()
    const colRef = userCollection(user.uid, 'incomes')

    const snapshot = await getDocs(query(colRef))
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
    const user = await getCurrentUserAsync()
    const colRef = userCollection(user.uid, 'expenses')

    const q = query(
      colRef,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  async getTotalByCategory() {
    const user = await getCurrentUserAsync()
    const colRef = userCollection(user.uid, 'expenses')

    const snapshot = await getDocs(query(colRef))
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
    const user = await getCurrentUserAsync()
    const docRef = doc(db, 'users', user.uid, 'savingsGoals', goalId)
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
    const user = await getCurrentUserAsync()
    const budgetCol = userCollection(user.uid, 'budgets')
    const expenseCol = userCollection(user.uid, 'expenses')

    // Get all budgets
    const budgetSnapshot = await getDocs(query(budgetCol))
    const budgets = budgetSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Get current month expenses
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const expenseQuery = query(
      expenseCol,
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

// NOTE: the former lifetime-total `analyticsService` and `insightsService` were removed in the
// transaction-model upgrade (they summed all history, truncated at 500 docs and ignored
// periods). All analytics now come from src/lib/finance over period-scoped transactions.

// Market Service — STATIC SAMPLE DATA (not live market prices)
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
