import { lazy, type ComponentType } from 'react'

const KEY = 'ff_chunk_reload'

/**
 * After a new deploy the old page may ask for code files that no longer exist
 * ("Failed to fetch dynamically imported module"). Reload once to pick up the new version
 * instead of showing a broken screen. Guarded so it can never loop.
 */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 15000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch { /* storage unavailable: still try once */ }
  window.location.reload()
  return true
}

export function lazyRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() => factory().catch((err) => {
    if (reloadForNewVersion()) return new Promise<{ default: T }>(() => {}) // page is reloading
    throw err
  }))
}
