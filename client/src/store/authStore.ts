import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User as FirebaseUser } from 'firebase/auth'
import { authService } from '../services/firebaseService'
import { User } from '../types'

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  updateUser: (data: Partial<User>) => void
  clearError: () => void
  setFirebaseUser: (user: FirebaseUser | null) => void
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName?: string
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const firebaseUser = await authService.login(email, password)
          const profileData = await authService.getUserProfile(firebaseUser.uid) as any
          
          const user: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            profile: {
              firstName: profileData?.profile?.firstName || firebaseUser.displayName?.split(' ')[0] || 'User',
              lastName: profileData?.profile?.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
              avatar: profileData?.profile?.avatar,
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
          }
          
          set({
            user,
            firebaseUser,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })
        } catch (error: any) {
          const message = error.message || 'Login failed'
          set({ isLoading: false, error: message })
          throw new Error(message)
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null })
        try {
          const firebaseUser = await authService.register(
            data.email,
            data.password,
            data.firstName,
            data.lastName || ''
          )
          
          const user: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            profile: {
              firstName: data.firstName,
              lastName: data.lastName || ''
            },
            preferences: {
              currency: 'LKR',
              language: 'en'
            }
          }
          
          set({
            user,
            firebaseUser,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })
        } catch (error: any) {
          const message = error.message || 'Registration failed'
          set({ isLoading: false, error: message })
          throw new Error(message)
        }
      },

      logout: async () => {
        try {
          await authService.logout()
        } catch (error) {
          console.error('Logout error:', error)
        }
        set({
          user: null,
          firebaseUser: null,
          isAuthenticated: false,
          error: null
        })
      },

      checkAuth: async () => {
        set({ isLoading: true })
        const firebaseUser = authService.getCurrentUser()
        
        if (!firebaseUser) {
          set({ isAuthenticated: false, isLoading: false })
          return
        }

        try {
          const profileData = await authService.getUserProfile(firebaseUser.uid) as any
          
          const user: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            profile: {
              firstName: profileData?.profile?.firstName || firebaseUser.displayName?.split(' ')[0] || 'User',
              lastName: profileData?.profile?.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
              avatar: profileData?.profile?.avatar,
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
          }
          
          set({
            user,
            firebaseUser,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error) {
          set({
            user: null,
            firebaseUser: null,
            isAuthenticated: false,
            isLoading: false
          })
        }
      },

      setFirebaseUser: (firebaseUser: FirebaseUser | null) => {
        if (!firebaseUser) {
          set({
            user: null,
            firebaseUser: null,
            isAuthenticated: false,
            isLoading: false
          })
          return
        }
        
        // Fetch profile async
        authService.getUserProfile(firebaseUser.uid).then(profile => {
          const profileData = profile as any
          const user: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            profile: {
              firstName: profileData?.profile?.firstName || firebaseUser.displayName?.split(' ')[0] || 'User',
              lastName: profileData?.profile?.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
              avatar: profileData?.profile?.avatar,
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
          }
          
          set({
            user,
            firebaseUser,
            isAuthenticated: true,
            isLoading: false
          })
        }).catch(() => {
          set({
            user: null,
            firebaseUser: null,
            isAuthenticated: false,
            isLoading: false
          })
        })
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
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Don't persist Firebase user, just keep a flag
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
