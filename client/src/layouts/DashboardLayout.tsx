import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useFinanceStore } from '../store/financeStore'
import { auth } from '../config/firebase'
import QuickAdd from '../components/finance/QuickAdd'
import TransactionForm from '../components/finance/TransactionForm'
import { useThemeStore } from '../store/themeStore'
import {
  HomeIcon,
  BanknotesIcon,
  CreditCardIcon,
  ChartBarIcon,
  ChartPieIcon,
  LightBulbIcon,
  BuildingLibraryIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  WalletIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  ListBulletIcon,
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  BuildingLibraryIcon as BankIcon,
  ClipboardDocumentListIcon,
  DocumentChartBarIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Transactions', href: '/transactions', icon: ListBulletIcon },
  { name: 'Income', href: '/income', icon: BanknotesIcon },
  { name: 'Expenses', href: '/expenses', icon: CreditCardIcon },
  { name: 'Cash Flow', href: '/cashflow', icon: ArrowsRightLeftIcon },
  { name: 'Calendar', href: '/calendar', icon: CalendarDaysIcon },
  { name: 'Accounts & Net Worth', href: '/accounts', icon: BankIcon },
  { name: 'Budgets', href: '/budgets', icon: ChartPieIcon },
  { name: 'Planning & Bills', href: '/planning', icon: ClipboardDocumentListIcon },
  { name: 'Savings Goals', href: '/savings', icon: WalletIcon },
  { name: 'Investments', href: '/investments', icon: ChartBarIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Insights', href: '/insights', icon: LightBulbIcon },
  { name: 'Reports', href: '/reports', icon: DocumentChartBarIcon },
  { name: 'CSE Market', href: '/market', icon: BuildingLibraryIcon },
  { name: 'Global Markets', href: '/global-markets', icon: GlobeAltIcon },
  { name: 'Crypto', href: '/crypto', icon: CurrencyDollarIcon },
]

// ── Enterprise AI Navigation ──────────────────────────────────────────────────
const enterpriseNavigation = [
  { name: '🤖 AI Advisor', href: '/ai-advisor', icon: LightBulbIcon, badge: 'NEW' },
  { name: '🎙️ Voice', href: '/voice', icon: LightBulbIcon, badge: 'NEW' },
  { name: '❤️ Health Score', href: '/health-score', icon: ChartPieIcon, badge: 'NEW' },
  { name: '🏗️ Architecture', href: '/architecture', icon: GlobeAltIcon, badge: 'NEW' },
  { name: '👔 Advisor Portal', href: '/advisor', icon: UserCircleIcon, badge: 'NEW' },
  { name: '👨‍👩‍👧‍👦 Family', href: '/family', icon: HomeIcon, badge: 'NEW' },
]

// Mobile bottom navigation (large touch targets); Quick Add floats above it
const mobileTabs = [
  { name: 'Home', href: '/dashboard', icon: HomeIcon },
  { name: 'Activity', href: '/transactions', icon: ListBulletIcon },
  { name: 'Budgets', href: '/budgets', icon: ChartPieIcon },
  { name: 'Insights', href: '/insights', icon: LightBulbIcon },
]

function SyncStatus() {
  const { pendingWrites } = useFinanceStore()
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (online && !pendingWrites) return null
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${online ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
      {online ? `Syncing ${pendingWrites}…` : `Offline${pendingWrites ? ` · ${pendingWrites} to sync` : ' · entries will sync later'}`}
    </span>
  )
}

const bottomNavigation = [
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  { name: 'Profile', href: '/profile', icon: UserCircleIcon },
]


export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const initFinance = useFinanceStore(s => s.init)
  const stopFinance = useFinanceStore(s => s.stop)

  // Start live, offline-capable data subscriptions for the signed-in user
  useEffect(() => {
    const uid = auth.currentUser?.uid || user?.id
    if (uid) initFinance(uid)
  }, [user?.id, initFinance])

  const handleLogout = () => {
    stopFinance()
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <NavLink to="/dashboard" className="flex items-center gap-2">
              <div className="w-9 h-9 gradient-green rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 4L35 12V28L20 36L5 28V12L20 4Z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                  <path d="M12 16L16 20L28 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 24L16 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M28 24L24 20L28 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="20" cy="20" r="2.5" fill="currentColor"/>
                </svg>
              </div>
              <span className="font-bold text-gray-900 dark:text-white">FinanceFlow</span>
            </NavLink>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}

            {/* ── Enterprise AI Section ── */}
            <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="px-3 py-1.5 mb-1">
                <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-indigo-500 uppercase tracking-wider">Enterprise AI</span>
              </div>
              {enterpriseNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`
                  }
                >
                  <span className="text-base">{item.name.split(' ')[0]}</span>
                  <span className="flex-1">{item.name.split(' ').slice(1).join(' ')}</span>
                  {item.badge && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-semibold">{item.badge}</span>
                  )}
                </NavLink>
              ))}
            </div>

            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
              {bottomNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 gradient-green rounded-full flex items-center justify-center text-white font-medium">
                {user?.profile.firstName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.profile.firstName} {user?.profile.lastName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>

          <div className="flex-1 lg:flex-none flex items-center gap-2 px-2">
            <SyncStatus />
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <SunIcon className="w-5 h-5" />
              ) : (
                <MoonIcon className="w-5 h-5" />
              )}
            </button>

            {/* Notifications */}
            <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative">
              <BellIcon className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User avatar (mobile) */}
            <NavLink
              to="/profile"
              className="lg:hidden w-8 h-8 gradient-green rounded-full flex items-center justify-center text-white text-sm font-medium"
            >
              {user?.profile.firstName?.[0]?.toUpperCase() || 'U'}
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
          <Outlet />
        </main>

        {/* Mobile bottom navigation */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around pb-[env(safe-area-inset-bottom)]">
          {mobileTabs.map(t => (
            <NavLink key={t.href} to={t.href} className={({ isActive }) => `flex flex-col items-center justify-center min-h-[56px] min-w-[64px] text-[11px] ${isActive ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`}>
              <t.icon className="w-6 h-6" />{t.name}
            </NavLink>
          ))}
          <button onClick={() => setSidebarOpen(true)} className="flex flex-col items-center justify-center min-h-[56px] min-w-[64px] text-[11px] text-gray-500 dark:text-gray-400">
            <EllipsisHorizontalIcon className="w-6 h-6" />More
          </button>
        </nav>

        <QuickAdd />
        <TransactionForm />
      </div>
    </div>
  )
}
