import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import { gatewayUrl, idToken } from '../services/backend'

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080'

// ─── Auth Store (replaces Firebase with JWT/OIDC) ────────────────────────────

interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  avatar_url?: string
  currency: string
  theme: string
  roles: string[]
  is_advisor: boolean
}

interface AuthState {
  user: UserProfile | null
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshAccessToken: () => Promise<void>
  updateUser: (data: Partial<UserProfile>) => void
  initAuth: () => () => void
  clearError: () => void
}

interface RegisterData {
  email: string
  password: string
  first_name: string
  last_name?: string
  role?: 'normal_user' | 'financial_advisor'
}

// Configure axios instance pointing to WSO2 API Gateway
export const apiClient = axios.create({ baseURL: GATEWAY_URL })

// Request interceptor — add Bearer token to all requests
apiClient.interceptors.request.use(async (config) => {
  // Hosted gateway + the signed-in user's Firebase ID token (verified by gateway and backend).
  config.baseURL = gatewayUrl()
  const token = (await idToken()) || useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor — auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      // Firebase ID tokens expire hourly: force a refresh once and retry.
      const fresh = await idToken(true)
      if (fresh) {
        original.headers.Authorization = `Bearer ${fresh}`
        return apiClient(original)
      }
    }
    return Promise.reject(error)
  }
)

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      idToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,

      initAuth: () => {
        // Check existing tokens on app start
        const state = get()
        if (state.accessToken && state.user) {
          set({ isAuthenticated: true, isInitialized: true })
        } else {
          set({ isInitialized: true })
        }
        return () => {}
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await axios.post(`${GATEWAY_URL}/api/v1/auth/login`, { email, password })
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            idToken: data.id_token,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })
        } catch (err: any) {
          const message = err.response?.data?.detail || 'Login failed'
          set({ error: message, isLoading: false })
          throw new Error(message)
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null })
        try {
          const { data: res } = await axios.post(`${GATEWAY_URL}/api/v1/auth/register`, data)
          set({
            user: res.user,
            accessToken: res.access_token,
            refreshToken: res.refresh_token,
            idToken: res.id_token,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })
        } catch (err: any) {
          const message = err.response?.data?.detail || 'Registration failed'
          set({ error: message, isLoading: false })
          throw new Error(message)
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          idToken: null,
          isAuthenticated: false,
          error: null
        })
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await axios.post(`${GATEWAY_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken })
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: data.user
        })
      },

      updateUser: (data: Partial<UserProfile>) => {
        const { user } = get()
        if (user) set({ user: { ...user, ...data } })
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'finai-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        idToken: state.idToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

// ─── Enterprise Store ─────────────────────────────────────────────────────────

interface GatewayAnalytics {
  total: number
  errors: number
  errorRate: string
  avgLatency: string
  byEndpoint: Record<string, number>
}

interface EnterpriseState {
  healthScore: number | null
  healthGrade: string | null
  aiInsights: any[]
  gatewayAnalytics: GatewayAnalytics | null
  fraudAlerts: number
  voiceEnabled: boolean
  advisorClients: any[]

  fetchHealthScore: () => Promise<void>
  fetchAIInsights: () => Promise<void>
  fetchGatewayAnalytics: () => Promise<void>
  fetchFraudSummary: () => Promise<void>
  setVoiceEnabled: (val: boolean) => void
  fetchAdvisorClients: () => Promise<void>
}

export const useEnterpriseStore = create<EnterpriseState>((set, get) => ({
  healthScore: null,
  healthGrade: null,
  aiInsights: [],
  gatewayAnalytics: null,
  fraudAlerts: 0,
  voiceEnabled: false,
  advisorClients: [],

  fetchHealthScore: async () => {
    try {
      const { data } = await apiClient.get('/api/v1/health-score/calculate')
      set({ healthScore: data.score, healthGrade: data.grade })
    } catch (e) {
      console.error('Health score fetch failed:', e)
    }
  },

  fetchAIInsights: async () => {
    try {
      const { data } = await apiClient.get('/api/v1/ai/insights?limit=5')
      set({ aiInsights: data.insights || [] })
    } catch (e) {
      console.error('AI insights fetch failed:', e)
    }
  },

  fetchGatewayAnalytics: async () => {
    try {
      const { data } = await axios.get(`${gatewayUrl()}/gateway/analytics`)
      set({ gatewayAnalytics: data.summary })
    } catch (e) {
      console.error('Gateway analytics fetch failed:', e)
    }
  },

  fetchFraudSummary: async () => {
    try {
      const { data } = await apiClient.get('/api/v1/fraud/summary')
      set({ fraudAlerts: data.flagged_transactions || 0 })
    } catch (e) {
      console.error('Fraud summary fetch failed:', e)
    }
  },

  setVoiceEnabled: (val) => set({ voiceEnabled: val }),

  fetchAdvisorClients: async () => {
    try {
      const { data } = await apiClient.get('/api/v1/advisor/clients')
      set({ advisorClients: data.clients || [] })
    } catch (e) {
      console.error('Advisor clients fetch failed:', e)
    }
  }
}))
