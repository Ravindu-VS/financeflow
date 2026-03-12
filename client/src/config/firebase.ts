import { initializeApp } from 'firebase/app'
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

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

export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
})

export const db = getFirestore(app)

export default app
