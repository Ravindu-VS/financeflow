import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { authService } from './services/firebaseService'
import { useAuthStore } from './store/authStore'

// Listen to Firebase auth state changes
authService.onAuthChange((user) => {
  useAuthStore.getState().setFirebaseUser(user)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
