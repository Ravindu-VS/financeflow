import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// E2E build: the real app with firebase/* swapped for in-memory fakes (no network, no PWA SW).
export default defineConfig({
  plugins: [react()],
  base: '/financeflow/',
  resolve: {
    alias: {
      'firebase/app': path.resolve(__dirname, 'e2e/fakes/firebase-app.ts'),
      'firebase/auth': path.resolve(__dirname, 'e2e/fakes/firebase-auth.ts'),
      'firebase/firestore': path.resolve(__dirname, 'e2e/fakes/firebase-firestore.ts'),
      'virtual:pwa-register': path.resolve(__dirname, 'e2e/fakes/firebase-app.ts'),
    },
  },
  server: { port: 4173, strictPort: true },
})
