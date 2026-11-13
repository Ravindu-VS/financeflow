import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true'
const appBase = isGitHubPagesBuild ? '/financeflow/' : '/'

export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FinanceFlow - Sri Lankan Financial Tracker',
        short_name: 'FinanceFlow',
        description: 'Track your finances, investments, and market trends in Sri Lanka',
        theme_color: '#0ea5e9',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: appBase,
        start_url: appBase,
        categories: ['finance', 'business', 'productivity'],
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Heavy on-demand libraries (Excel/PDF export, OCR) are cached when first used, not at install
        globIgnores: ['**/exceljs*.js', '**/jspdf*.js', '**/html2canvas*.js', '**/purify*.js', '**/index.es-*.js', '**/tesseract*.js'],
        navigateFallback: `${appBase}index.html`,
        navigateFallbackDenylist: [new RegExp(`^${appBase.replace('/', '\\/')}__`)],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(exceljs|jspdf|html2canvas|purify|index\.es|tesseract)[^/]*\.js$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'lazy-libs', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
          {
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com)\//i,
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-engine', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 60 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-charts': ['recharts', 'chart.js', 'react-chartjs-2'],
          'vendor-ui': ['@heroicons/react', '@headlessui/react']
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
