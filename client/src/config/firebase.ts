import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA0uQFX5CE0JPGxBoA3NUeCw4QOCCe4fjo",
  authDomain: "financial-tracker-e9cee.firebaseapp.com",
  projectId: "financial-tracker-e9cee",
  storageBucket: "financial-tracker-e9cee.firebasestorage.app",
  messagingSenderId: "146957008164",
  appId: "1:146957008164:web:d9334112c3bde81e5b87b1",
  measurementId: "G-Y6QQKJQB90"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)

// Analytics is optional and may be blocked by ad blockers
export let analytics: any = null
if (typeof window !== 'undefined') {
  import('firebase/analytics').then(({ getAnalytics }) => {
    try {
      analytics = getAnalytics(app)
    } catch (e) {
      console.log('Analytics not available')
    }
  }).catch(() => {
    console.log('Analytics module not loaded')
  })
}

export default app
