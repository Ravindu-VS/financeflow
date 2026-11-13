import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, Suspense, lazy } from 'react'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { useEnterpriseStore } from './store/enterpriseStore'
import PWAInstallPrompt from './components/PWAInstallPrompt'

// Layouts (load immediately)
import AuthLayout from './layouts/AuthLayout'
import DashboardLayout from './layouts/DashboardLayout'

// Lazy load all pages for better performance
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'))
const IncomePage = lazy(() => import('./components/income/IncomePage'))
const ExpensesPage = lazy(() => import('./components/expenses/ExpensesPage'))
const SavingsPage = lazy(() => import('./components/savings/SavingsPage'))
const InvestmentsPage = lazy(() => import('./components/investments/InvestmentsPage'))
const BudgetsPage = lazy(() => import('./components/budgets/BudgetsPage'))
const AnalyticsPage = lazy(() => import('./components/analytics/AnalyticsPage'))
const InsightsPage = lazy(() => import('./components/insights/InsightsPage'))
const MarketPage = lazy(() => import('./components/market/MarketPage'))
const GlobalMarketsPage = lazy(() => import('./components/market/GlobalMarketsPage'))
const CryptoMarketPage = lazy(() => import('./components/market/CryptoMarketPage'))
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'))
const ProfilePage = lazy(() => import('./components/profile/ProfilePage'))
const LoginPage = lazy(() => import('./components/auth/LoginPage'))
const RegisterPage = lazy(() => import('./components/auth/RegisterPage'))
const NotFoundPage = lazy(() => import('./components/NotFoundPage'))

// ── Transaction-centric pages ────────────────────────────────────────────────
const TransactionsPage = lazy(() => import('./components/transactions/TransactionsPage'))
const CashFlowPage = lazy(() => import('./components/cashflow/CashFlowPage'))
const CalendarPage = lazy(() => import('./components/calendar/CalendarPage'))
const AccountsPage = lazy(() => import('./components/accounts/AccountsPage'))
const PlanningPage = lazy(() => import('./components/recurring/PlanningPage'))

// ── Enterprise Pages (NEW) ───────────────────────────────────────────────────
const AIChatPage = lazy(() => import('./components/ai/AIChatPage'))
const VoiceAssistantPage = lazy(() => import('./components/voice/VoiceAssistant'))
const ReportCenterPage = lazy(() => import('./components/reports/ReportCenter'))
const FinancialHealthPage = lazy(() => import('./components/health/FinancialHealthPage'))
const AdvisorPortalPage = lazy(() => import('./components/advisor/AdvisorPortal'))
const FamilyAccountsPage = lazy(() => import('./components/family/FamilyAccounts'))

// Loading spinner component
const PageLoader = () => (
  <div className="min-h-[400px] flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
  </div>
)

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore()

  // Wait for auth to be fully initialized
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Public Route (redirect to dashboard if authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore()

  // Wait for auth to be fully initialized
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  const { theme } = useThemeStore()
  const initAuth = useAuthStore((state) => state.initAuth)

  // Initialize Firebase Auth listener once on app mount
  useEffect(() => {
    const unsubscribe = initAuth()
    return () => unsubscribe()
  }, [initAuth])

  useEffect(() => {
    // Apply theme class to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <BrowserRouter basename="/financeflow">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route element={<AuthLayout />}>
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <RegisterPage />
                  </PublicRoute>
                }
              />
            </Route>

            {/* Protected Routes */}
            <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/cashflow" element={<CashFlowPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/recurring" element={<Navigate to="/planning" replace />} />
            <Route path="/income" element={<IncomePage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/savings" element={<SavingsPage />} />
            <Route path="/investments" element={<InvestmentsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/global-markets" element={<GlobalMarketsPage />} />
            <Route path="/crypto" element={<CryptoMarketPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            {/* ── Enterprise Routes (NEW) ── */}
            <Route path="/ai-advisor" element={<AIChatPage />} />
            <Route path="/voice" element={<VoiceAssistantPage />} />
            {/* Architecture/service-health page removed (developer-only); old links go to the dashboard */}
            <Route path="/architecture" element={<Navigate to="/dashboard" replace />} />
            <Route path="/reports" element={<ReportCenterPage />} />
            <Route path="/health-score" element={<FinancialHealthPage />} />
            <Route path="/advisor" element={<AdvisorPortalPage />} />
            <Route path="/family" element={<FamilyAccountsPage />} />
          </Route>

          {/* Redirect root to dashboard or login */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 Page */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: theme === 'dark' ? '#1f2937' : '#fff',
            color: theme === 'dark' ? '#fff' : '#1f2937',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </BrowserRouter>
  )
}

export default App
