import { initializeApp } from 'firebase/app'
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, Firestore } from 'firebase/firestore'

// Values come from VITE_FIREBASE_* (injected by CI / client/.env). The fallbacks keep the
// existing deployment working; the Firebase web config is public by design — data access
// is protected by Firestore security rules (see /firestore.rules).
const env = import.meta.env
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBSUGP0sYUxDNdz68X7iIqITSxZAjxueG0',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'financeflow-a6aa0.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'financeflow-a6aa0',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'financeflow-a6aa0.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '954990958720',
  appId: env.VITE_FIREBASE_APP_ID || '1:954990958720:web:ec53960e0ff217ced5ee65',
}

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
