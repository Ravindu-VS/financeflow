import { create } from 'zustand'
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth'
import { authService } from '../services/firebaseService'
import { auth } from '../config/firebase'
import { User } from '../types'

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  
  // Actions
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  initAuth: () => () => void
  updateUser: (data: Partial<User>) => void
  clearError: () => void
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName?: string
}

// Helper to create user object from Firebase user and profile data
const createUserObject = (firebaseUser: FirebaseUser, profileData: any): User => ({
  id: firebaseUser.uid,
  email: firebaseUser.email || '',
  profile: {
    firstName: profileData?.profile?.firstName || firebaseUser.displayName?.split(' ')[0] || 'User',
    lastName: profileData?.profile?.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
    avatar: profileData?.profile?.avatar || firebaseUser.photoURL || '',
    phone: profileData?.profile?.phone,
    dateOfBirth: profileData?.profile?.dateOfBirth,
    occupation: profileData?.profile?.occupation,
    monthlyIncome: profileData?.profile?.monthlyIncome,
    bio: profileData?.profile?.bio
  },
  preferences: {
    currency: profileData?.preferences?.currency || 'LKR',
    language: profileData?.preferences?.language || 'en',
    theme: (profileData?.preferences?.theme as 'light' | 'dark' | 'system') || 'dark'
  }
})

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  firebaseUser: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  error: null,

  // Initialize auth listener - call this once on app start
  initAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Set authenticated immediately with basic info — no waiting for Firestore
        set({
          user: createUserObject(firebaseUser, null),
          firebaseUser,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true
        })

        // Load full profile in background
        try {
          await authService._ensureUserProfile(firebaseUser)
          const profileData = await authService.getUserProfile(firebaseUser.uid)
          if (profileData) {
            set({ user: createUserObject(firebaseUser, profileData) })
          }
        } catch (error) {
          console.error('Error loading profile:', error)
        }
      } else {
        set({
          user: null,
          firebaseUser: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true
        })
      }
    })

    return unsubscribe
  },

  login: async (email: string, password: string) => {
    set({ error: null })
    try {
      await authService.login(email, password)
      // onAuthStateChanged will set isAuthenticated immediately
    } catch (error: any) {
      const message = error.message || 'Login failed'
      set({ error: message })
      throw new Error(message)
    }
  },

  loginWithGoogle: async () => {
    set({ error: null })
    try {
      await authService.loginWithGoogle()
      // onAuthStateChanged will set isAuthenticated immediately
    } catch (error: any) {
      const message = error.message || 'Google login failed'
      set({ error: message })
      throw new Error(message)
    }
  },

  register: async (data: RegisterData) => {
    set({ error: null })
    try {
      await authService.register(
        data.email,
        data.password,
        data.firstName,
        data.lastName || ''
      )
      // onAuthStateChanged will set isAuthenticated immediately
    } catch (error: any) {
      const message = error.message || 'Registration failed'
      set({ error: message })
      throw new Error(message)
    }
  },

  logout: async () => {
    try {
      await authService.logout()
      // Auth state listener will handle the rest
    } catch (error) {
      console.error('Logout error:', error)
      // Force clear state even if logout fails
      set({
        user: null,
        firebaseUser: null,
        isAuthenticated: false,
        error: null
      })
    }
  },

  updateUser: (data: Partial<User>) => {
    const { user, firebaseUser } = get()
    if (user && firebaseUser) {
      const updatedUser = { ...user, ...data }
      set({ user: updatedUser })
      
      // Update in Firestore
      authService.updateUserProfile(firebaseUser.uid, data).catch(console.error)
    }
  },

  clearError: () => set({ error: null })
}))
