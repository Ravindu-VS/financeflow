import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { reloadForNewVersion } from './utils/lazyRetry'

// A newer version was deployed while this tab was open: reload once instead of breaking.
window.addEventListener('vite:preloadError', (e) => { if (reloadForNewVersion()) e.preventDefault() })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
