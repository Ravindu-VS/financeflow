import { initializeApp } from 'firebase/app'
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth'
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

// Initialize Auth
export const auth = getAuth(app)

// Initialize Firestore with persistent cache (modern API)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
})

// Set auth persistence to LOCAL (survives browser restart)
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.log('Auth persistence error:', err)
})

export default app
