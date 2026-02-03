import { useState, useEffect } from 'react'
import { XMarkIcon, DevicePhoneMobileIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed as PWA
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
    setIsStandalone(isInStandaloneMode)

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(iOS)

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Check if user has dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      const dismissedTime = dismissed ? parseInt(dismissed) : 0
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
      
      // Show prompt if not dismissed or dismissed more than 7 days ago
      if (!dismissed || daysSinceDismissed > 7) {
        setTimeout(() => setShowPrompt(true), 3000) // Show after 3 seconds
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    // For iOS, show prompt after delay
    if (iOS && !isInStandaloneMode) {
      const dismissed = localStorage.getItem('pwa-install-dismissed-ios')
      const dismissedTime = dismissed ? parseInt(dismissed) : 0
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24)
      
      if (!dismissed || daysSinceDismissed > 7) {
        setTimeout(() => setShowPrompt(true), 5000)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem(isIOS ? 'pwa-install-dismissed-ios' : 'pwa-install-dismissed', Date.now().toString())
  }

  if (!showPrompt || isStandalone) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-indigo-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <DevicePhoneMobileIcon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Install FinanceFlow</h3>
                <p className="text-sm text-white/80">Get the full app experience</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Works offline
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Faster loading
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Home screen access
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Push notifications
            </li>
          </ul>

          {isIOS ? (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-sm">
              <p className="font-medium text-gray-900 dark:text-white mb-2">To install on iOS:</p>
              <ol className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>1. Tap the <span className="font-medium">Share</span> button <span className="inline-block w-5 h-5 align-middle">⎙</span></li>
                <li>2. Scroll down and tap <span className="font-medium">"Add to Home Screen"</span></li>
                <li>3. Tap <span className="font-medium">"Add"</span> to confirm</li>
              </ol>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Install App
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
