import { initializeApp } from 'firebase/app'
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBSUGP0sYUxDNdz68X7iIqITSxZAjxueG0",
  authDomain: "financeflow-a6aa0.firebaseapp.com",
  projectId: "financeflow-a6aa0",
  storageBucket: "financeflow-a6aa0.firebasestorage.app",
  messagingSenderId: "954990958720",
  appId: "1:954990958720:web:ec53960e0ff217ced5ee65",
  measurementId: "G-GNNL3C379P"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
})

export const db = getFirestore(app)

export default app
