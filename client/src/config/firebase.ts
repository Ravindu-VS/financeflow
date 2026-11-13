import { initializeApp } from 'firebase/app'
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, Firestore } from 'firebase/firestore'

// Firebase web config for project financeflow-a6aa0. These values are public by design;
// data access is protected by Firestore security rules (see /firestore.rules).
//
// VITE_FIREBASE_* environment values are applied ONLY when they target this same project.
// Stale CI secrets from an old Firebase project once overrode this config and broke sign-in
// ("API key not valid"), so env values for any other project are ignored with a warning.
const DEFAULT_CONFIG = {
  apiKey: 'AIzaSyBSUGP0sYUxDNdz68X7iIqITSxZAjxueG0',
  authDomain: 'financeflow-a6aa0.firebaseapp.com',
  projectId: 'financeflow-a6aa0',
  storageBucket: 'financeflow-a6aa0.firebasestorage.app',
  messagingSenderId: '954990958720',
  appId: '1:954990958720:web:ec53960e0ff217ced5ee65',
}
const env = import.meta.env
const envMatches = env.VITE_FIREBASE_PROJECT_ID === DEFAULT_CONFIG.projectId && !!env.VITE_FIREBASE_API_KEY && !!env.VITE_FIREBASE_APP_ID
if (env.VITE_FIREBASE_PROJECT_ID && !envMatches) {
  console.warn(`[firebase] Ignoring VITE_FIREBASE_* for project "${env.VITE_FIREBASE_PROJECT_ID}"; using ${DEFAULT_CONFIG.projectId}.`)
}
const firebaseConfig = envMatches
  ? {
      apiKey: env.VITE_FIREBASE_API_KEY!,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_CONFIG.authDomain,
      projectId: DEFAULT_CONFIG.projectId,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_CONFIG.storageBucket,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_CONFIG.messagingSenderId,
      appId: env.VITE_FIREBASE_APP_ID!,
    }
  : DEFAULT_CONFIG

const app = initializeApp(firebaseConfig)

export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
})

// Offline-first: IndexedDB cache + multi-tab. Writes made offline are queued and synced
// automatically when the connection returns. Falls back to memory cache where IndexedDB
// is unavailable (e.g. some private-browsing modes).
let db: Firestore
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
} catch (e) {
  console.warn('[firebase] persistent cache unavailable, using memory cache', e)
  db = initializeFirestore(app, { localCache: memoryLocalCache() })
}
export { db }

export default app
