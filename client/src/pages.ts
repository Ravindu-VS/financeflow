import { lazy } from 'react'

// Lazy load all pages for better code splitting
export const Dashboard = lazy(() => import('./components/dashboard/Dashboard'))
export const IncomePage = lazy(() => import('./components/income/IncomePage'))
export const ExpensesPage = lazy(() => import('./components/expenses/ExpensesPage'))
export const SavingsPage = lazy(() => import('./components/savings/SavingsPage'))
export const InvestmentsPage = lazy(() => import('./components/investments/InvestmentsPage'))
export const BudgetsPage = lazy(() => import('./components/budgets/BudgetsPage'))
export const AnalyticsPage = lazy(() => import('./components/analytics/AnalyticsPage'))
export const InsightsPage = lazy(() => import('./components/insights/InsightsPage'))
export const MarketPage = lazy(() => import('./components/market/MarketPage'))
export const GlobalMarketsPage = lazy(() => import('./components/market/GlobalMarketsPage'))
export const CryptoMarketPage = lazy(() => import('./components/market/CryptoMarketPage'))
export const SettingsPage = lazy(() => import('./components/settings/SettingsPage'))
export const ProfilePage = lazy(() => import('./components/profile/ProfilePage'))
export const LoginPage = lazy(() => import('./components/auth/LoginPage'))
export const RegisterPage = lazy(() => import('./components/auth/RegisterPage'))
export const NotFoundPage = lazy(() => import('./components/NotFoundPage'))

// Layouts don't need lazy loading - they're always needed
export { default as AuthLayout } from './layouts/AuthLayout'
export { default as DashboardLayout } from './layouts/DashboardLayout'
