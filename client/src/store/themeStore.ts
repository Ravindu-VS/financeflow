import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'

interface ThemeState {
  /** What the user chose */
  theme: Theme
  /** What is actually shown right now (system → follows the OS, live) */
  resolved: Resolved
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
const resolve = (t: Theme): Resolved => (t === 'system' ? (mq?.matches ? 'dark' : 'light') : t)

/** One place that applies the theme: the `dark` class (Tailwind), native controls and the browser UI colour. */
export function applyTheme(theme: Theme): Resolved {
  const r = resolve(theme)
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.classList.toggle('dark', r === 'dark')
    root.style.colorScheme = r // date pickers, selects, scrollbars follow the app theme, not the OS
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', r === 'dark' ? '#111827' : '#ffffff')
  }
  return r
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolved: resolve('system'),
      setTheme: (theme: Theme) => set({ theme, resolved: applyTheme(theme) }),
      // Flip what the user currently sees (so the first tap always changes the screen)
      toggleTheme: () => { const next: Resolved = get().resolved === 'dark' ? 'light' : 'dark'; set({ theme: next, resolved: applyTheme(next) }) },
    }),
    {
      name: 'theme-storage',
      partialize: s => ({ theme: s.theme }) as any,
      onRehydrateStorage: () => state => { if (state) state.resolved = applyTheme(state.theme) },
    }
  )
)

// Follow the OS live while the choice is "system"
mq?.addEventListener?.('change', () => {
  const { theme } = useThemeStore.getState()
  if (theme === 'system') useThemeStore.setState({ resolved: applyTheme('system') })
})
