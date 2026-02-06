# FinanceFlow 💰

A modern Progressive Web App (PWA) for personal finance management, designed specifically for Sri Lankan users.

![FinanceFlow](https://img.shields.io/badge/FinanceFlow-v1.0.0-blue)
![PWA](https://img.shields.io/badge/PWA-Ready-green)
![React](https://img.shields.io/badge/React-18.2-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)

## ✨ Features

- 📊 **Dashboard** - Complete financial overview at a glance
- 💵 **Income Tracking** - Track all your income sources
- 💳 **Expense Management** - Categorize and monitor spending
- 🏦 **Savings Goals** - Set and track savings targets
- 📈 **Investments** - Portfolio tracking with market data
- 💹 **Market Data** - CSE stocks, global markets, crypto prices
- 🔮 **AI Predictions** - Price predictions with confidence scores
- 💡 **Investment Advice** - Strategies tailored for Sri Lanka
- 📱 **PWA** - Install on phone, works offline
- 🌙 **Dark Mode** - Eye-friendly dark theme
- 🇱🇰 **LKR Support** - Sri Lankan Rupee as default currency

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase account (for authentication & database)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/financeflow.git
cd financeflow

# Install dependencies
cd client
npm install

# Create environment file
cp .env.example .env

# Add your Firebase configuration to .env
# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the `client` directory:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 📱 Install as PWA (Mobile App)

### On Android

1. Visit the deployed website in Chrome
2. A prompt will appear to "Install FinanceFlow"
3. Tap **"Install"**
4. The app will be added to your home screen

### On iPhone/iPad (iOS)

1. Visit the deployed website in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** to confirm

### On Desktop (Chrome/Edge)

1. Visit the deployed website
2. Click the install icon (⊕) in the address bar
3. Click **"Install"**

## 🌐 Deployment to GitHub Pages

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click **"New"** to create a new repository
3. Name it `financeflow` (or your preferred name)
4. Select **"Public"** (required for free GitHub Pages)
5. Click **"Create repository"**

### Step 2: Push Code to GitHub

Open terminal in the project folder and run:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - FinanceFlow PWA"

# Add remote origin (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/financeflow.git

# Push to main branch
git push -u origin main
```

### Step 3: Configure GitHub Secrets

Your Firebase credentials need to be stored as secrets:

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add each:

| Secret Name | Value |
|-------------|-------|
| `VITE_FIREBASE_API_KEY` | Your Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | your-project-id |
| `VITE_FIREBASE_STORAGE_BUCKET` | your-project.appspot.com |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your Sender ID |
| `VITE_FIREBASE_APP_ID` | Your App ID |

### Step 4: Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Under "Build and deployment":
   - Source: Select **"GitHub Actions"**
3. The deployment will run automatically when you push to main

### Step 5: Access Your App

After the deployment completes (2-3 minutes), your app will be live at:

```
https://YOUR_USERNAME.github.io/financeflow/
```

## 🔄 Updating the App

Simply push new changes to the main branch:

```bash
git add .
git commit -m "Your update message"
git push
```

GitHub Actions will automatically rebuild and deploy.

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI Framework |
| TypeScript | Type Safety |
| Vite | Build Tool |
| Tailwind CSS | Styling |
| Firebase | Auth & Database |
| Zustand | State Management |
| Vite PWA | Progressive Web App |
| Workbox | Service Worker |
| Recharts | Charts |
| Heroicons | Icons |

## 📁 Project Structure

```
financeflow/
├── client/
│   ├── public/
│   │   ├── pwa-192x192.png      # App icon (192x192)
│   │   ├── pwa-512x512.png      # App icon (512x512)
│   │   └── favicon.svg          # Browser favicon
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── dashboard/
│   │   │   ├── market/
│   │   │   ├── auth/
│   │   │   └── ...
│   │   ├── layouts/             # Page layouts
│   │   ├── services/            # Firebase services
│   │   ├── store/               # Zustand stores
│   │   ├── App.tsx              # Main app component
│   │   └── main.tsx             # Entry point
│   ├── index.html
│   ├── vite.config.ts           # Vite + PWA config
│   └── package.json
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions deploy
├── .gitignore
└── README.md
```

## 📊 Market Pages

### CSE Market (`/market`)
- Colombo Stock Exchange indices
- Top 10 stocks with P/E ratios
- Stock price predictions
- Sri Lankan bank interest rates
- Investment strategies for CSE

### Global Markets (`/global-markets`)
- S&P 500, FTSE, Nikkei, Sensex
- Currency exchange rates (vs LKR)
- Commodity prices (Gold, Oil)
- Global market predictions
- International investment strategies

### Crypto Market (`/crypto`)
- Top 10 cryptocurrencies
- Prices in USD and LKR
- Price predictions (1W, 1M, 3M)
- Fear & Greed index
- Crypto investment advice

## 🔒 Security

- ✅ Firebase Authentication (Google Sign-in)
- ✅ Environment variables for sensitive data
- ✅ HTTPS enforced on GitHub Pages
- ✅ Service Worker for secure caching
- ✅ No sensitive data in client-side code

## 🐛 Troubleshooting

### Build fails on GitHub Actions

1. Check if all secrets are correctly added
2. Verify secret names match exactly (case-sensitive)
3. Check Actions tab for error logs

### PWA not installing

1. Site must be served over HTTPS
2. Clear browser cache and try again
3. Check if service worker is registered (DevTools → Application)

### App shows old content

1. Hard refresh: Ctrl/Cmd + Shift + R
2. Clear site data in DevTools → Application → Storage → Clear site data

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Vite](https://vitejs.dev/) - Next Generation Frontend Tooling
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Firebase](https://firebase.google.com/) - Backend as a Service
- [Heroicons](https://heroicons.com/) - Beautiful hand-crafted SVG icons

---

<p align="center">
  Made by Ravindu Vinusha
  <br>
  <a href="https://github.com/YOUR_USERNAME/financeflow">⭐ Star this repo</a>
</p>
