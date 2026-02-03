import { Outlet } from 'react-router-dom'
import { useThemeStore } from '../store/themeStore'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'

export default function AuthLayout() {
  const { theme, toggleTheme } = useThemeStore()
  
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-green items-center justify-center p-12">
        <div className="max-w-lg text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 4L35 12V28L20 36L5 28V12L20 4Z" stroke="white" strokeWidth="2" fill="none"/>
                <path d="M12 16L16 20L28 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 24L16 20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M28 24L24 20L28 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="20" cy="20" r="3" fill="white"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold">FinanceFlow</h1>
          </div>
          
          <h2 className="text-4xl font-bold mb-6">
            Smart Money Management for Sri Lankans
          </h2>
          
          <p className="text-xl text-white/80 mb-8">
            Track your income, expenses, savings, and investments with powerful 
            analytics designed for the Sri Lankan market.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                ✓
              </div>
              <span>Smart expense tracking & categorization</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                ✓
              </div>
              <span>AI-powered financial predictions</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                ✓
              </div>
              <span>Investment recommendations</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                ✓
              </div>
              <span>Personalized savings goals</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right side - Auth forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 relative">
        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
        </button>
        
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
