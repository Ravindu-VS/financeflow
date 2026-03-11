import { initializeApp } from 'firebase/app'
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA0uQFX5CE0JPGxBoA3NUeCw4QOCCe4fjo",
  authDomain: "financial-tracker-e9cee.firebaseapp.com",
  projectId: "financial-tracker-e9cee",
  storageBucket: "financial-tracker-e9cee.firebasestorage.app",
  messagingSenderId: "146957008164",
  appId: "1:146957008164:web:d9334112c3bde81e5b87b1"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Auth WITH persistence set at creation time (prevents race condition)
// This ensures onAuthStateChanged fires with the correct persisted user on first call
// Google OAuth Client ID (required for Google Sign-In on GitHub Pages)
// Get from: Firebase Console > Authentication > Sign-in method > Google > Web client ID
export const GOOGLE_CLIENT_ID = ''

export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence]
})

// Initialize Firestore with persistent cache (modern API)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
})

export default app
