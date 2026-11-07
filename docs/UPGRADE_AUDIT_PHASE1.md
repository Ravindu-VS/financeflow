# Finance Tracker — Phase 1 Architecture & Code Audit

**Date:** 2026-11-07 · **Scope:** read-only inspection, no code changed · **Repo HEAD:** `aea8712` (plus a large set of uncommitted enterprise files)

---

## 1. What the project actually is (vs. the upgrade brief)

The brief assumes **Next.js → WSO2 → FastAPI → PostgreSQL**. That's not what's in the repo. There are **three separate backends, and only one is connected to the UI:**

| Layer | Brief says | What exists | Status |
|---|---|---|---|
| Frontend | Next.js | **Vite 5 + React 18 + TS + Tailwind + vite-plugin-pwa**, deployed to GitHub Pages at `/financeflow/` | Working |
| Primary data store | PostgreSQL | **Firebase Firestore** (`users/{uid}/incomes`, `expenses`, `savingsGoals`, `investments`, `budgets`) | **Live — this holds all real user data** |
| Primary auth | WSO2 IS / OAuth2 | **Firebase Auth** (email + Google popup), `store/authStore.ts` | Working |
| Backend #1 | FastAPI | `ai-backend/`: FastAPI + SQLAlchemy + PostgreSQL, own JWT auth, Gemini/OpenAI LLM, voice NLP, reports, predictions | **Uncommitted, not reachable from deployed app, holds no user data** |
| Backend #2 | — | `server/`: Express + **MongoDB/Mongoose** | **Dead code.** Client's `services/api.ts` (`apiHelpers`) is imported nowhere |
| API gateway | WSO2 API Manager | `gateway/`: an **Express simulation** of WSO2 (JWT check, rate limit, proxy) | Uncommitted, local-only |
| WSO2 IS / MI / Integrator | Real WSO2 products | **Not present.** Only a descriptive page (`WSO2ArchitecturePage.tsx`) plus the simulated gateway | Missing |
| Infra | — | `docker-compose.yml`, `k8s/`, Prometheus/Grafana | Uncommitted, untested |

**Core consequence:** the enterprise pages (AI Advisor, Voice, Reports, Health Score, Advisor portal, Family) call the gateway with a JWT from `enterpriseStore`. But users sign in through **Firebase**, so that JWT is never set. And even with a token, the FastAPI backend reads PostgreSQL, which has **none of the user's Firestore data**. **The AI features can't use real user data today.**

---

## 2. Working features (keep)

- Firebase auth (email/password + Google), protected routes, session persistence
- CRUD for income, expenses, savings goals (with contribution history), investments, budgets: all work against Firestore user subcollections
- Budget status: compares budgets with **current-month** expenses (the only correctly period-scoped calculation in the app)
- Recharts cash-flow area chart and category pie chart
- Dark/light theme, currency formatting (LKR default, 9 currencies), lazy-loaded routes, PWA manifest + service worker (installable)
- Market pages (static/mock data), profile, settings
- Voice UI: Web Speech API capture, manual text fallback, intent display (backend parser in `ai-backend/routers/voice.py` uses regex intent and entity extraction)

## 3. Data-model problems (the core issue from the brief)

1. **Recurrence is a flag on the transaction, not a separate rule.** Income and expense docs carry `isRecurring` + `recurringFrequency`. Nothing generates future occurrences. A "monthly salary" entry is stored **once** and counted once, ever. The frequency is purely cosmetic.
2. **The Frequency dropdown is always shown and always submitted**, even when "Recurring" is unchecked, so one-time entries get saved with `recurringFrequency: 'monthly'` (react-hook-form default). This is the source of the "everything looks periodic" feel.
3. **No unified transaction model.** Income, expenses, savings contributions (an array nested inside the goal doc) and investments live in four unrelated shapes. There are no `type`, `account`, `source`, `status` or `recurrence_id` fields.
4. **No accounts, so no transfers.** Balances, cash flow, net worth and transfers can't be computed correctly.
5. **Savings and investments don't move money.** Contributing Rs. 5,000 to a goal or adding a Rs. 20,000 FD doesn't reduce available cash anywhere.
6. **Category vocabulary is inconsistent.** Expense categories are stored as **labels** ("Food & Dining"). Income categories are stored as **slugs** ("salary"). The Postgres schema and Express models use yet other vocabularies.
7. **Postgres schema (`ai-backend/database/schema.sql`) copies the same flaw**: separate `income` / `expenses` tables with `is_recurring` / `recurrence_type` columns. It's not the target model either.

## 4. Bugs found (with location)

| # | Bug | Where | Impact |
|---|---|---|---|
| B1 | **Dashboard shows lifetime totals** as primary figures | `analyticsService.getOverview()` sums all docs | Main UX complaint in the brief |
| B2 | **Hard-coded fake trend %** (+12.5%, −8.3%, +15.2%, +5.8%) | `Dashboard.tsx` StatCards | Misleading data shown as fact |
| B3 | "Expense Breakdown — *by category this month*" is actually **lifetime** | `getCategoryBreakdown()` | Wrong label/number |
| B4 | **Recent Transactions is always empty**: `recentTransactions` is never populated | `dashboardStore.ts` | Dead widget |
| B5 | **Totals silently truncated at 500** incomes/expenses (`limit(500)`) | `_fetchAllUserData()` | Wrong totals for active users |
| B6 | `avgDailyExpense = lifetimeTotal / 30` | `getOverview()` | Wrong metric |
| B7 | **Cache TTL ignored**: `getCached` always uses 60 s, so the 30 s `SHORT_CACHE_TTL` never applies | `firebaseService.ts` | Stale dashboard data |
| B8 | **Month filter does nothing** on Income and Expenses pages (`filter.month` captured, never applied) | `IncomePage.tsx`, `ExpensesPage.tsx` | Broken filter |
| B9 | "Essential Expenses" filters on `'Food','Bills','Housing'…` but stored values are `'Food & Dining'`, `'Bills & Utilities'` | `ExpensesPage.tsx` | Always ≈ 0 |
| B10 | Income "Income Sources" card shows **record count**, not distinct sources | `IncomePage.tsx` | Wrong stat |
| B11 | Recurring frequency saved on one-time items (see §3.2) | Income/Expense forms | Data pollution |
| B12 | **Health score** divides by `totalIncome` with no zero guard (NaN/∞ when income is 0). Net worth = lifetime (income − expenses) + investment value, which double-counts investment purchases that came out of income | `insightsService.getFinancialHealth()` | Wrong score/net worth |
| B13 | `getTrends('week')` actually returns ~1–2 months, grouped by month | `analyticsService` | Wrong view |
| B14 | **Date/timezone**: `new Date('YYYY-MM-DD')` parses as **UTC midnight**. Fine in Colombo (+5:30), but shifts to the previous day in negative-offset zones, and month boundaries use local time inconsistently | All forms + range queries | Edge-case misdated transactions |
| B15 | Investment ROI divides by `investment.amount` with no zero guard | `InvestmentsPage.tsx` | NaN display |
| B16 | `api.ts` 401 handler redirects to `/login`, ignoring the `/financeflow` basename | `services/api.ts` | 404 on GitHub Pages (dormant: file unused) |
| B17 | **TypeScript build fails**: no `vite-env.d.ts` (`import.meta.env`), no SpeechRecognition types | `enterpriseStore.ts`, `ReportCenter.tsx`, `WSO2ArchitecturePage.tsx`, `VoiceAssistant.tsx` | **`npm run build` (`tsc && vite build`) fails, so the next GitHub Pages deploy will fail** |
| B18 | **Two auth systems**: enterprise pages use `enterpriseStore` JWT, which is never issued to Firebase users. Calls 401 → refresh fails → enterprise logout | `enterpriseStore.ts` + all enterprise pages | AI Advisor / Voice / Reports / Health non-functional in practice |
| B19 | AI backend reads PostgreSQL, which has no user data | `ai-backend/routers/ai_advisor.py` | "AI uses real data" requirement not met |
| B20 | Insights/predictions are generic: static "PPF Account 7.1%", "Index funds 12–15%" (Indian products, return figures presented without caveat) | `insightsService` | Against brief §35 (never guarantee returns) |
| B21 | Market data is static mock (NIFTY/SENSEX) shown as if live | `marketService` | Misleading |

## 5. Duplicate / obsolete

- **`server/` (Express + MongoDB)**: fully duplicated by Firestore on the client. Unused. Candidate for removal (or archive).
- **`client/src/services/api.ts`**: unused axios client for the dead Express server.
- **`client/src/pages.ts`**: duplicates the lazy imports already in `App.tsx`. Unused.
- **Two auth stores** (`authStore.ts` Firebase vs `enterpriseStore.ts` JWT), both exporting `useAuthStore`. Name collision risk.
- **`client/dist/`, `client/dev-dist/`** build output sits in the working tree.
- **`README ft.md`** vs `README.md`: two READMEs.

## 6. Missing features (vs. brief)

Unified transactions · recurring **rules** + generation + skip/modify-future · accounts & transfers · global period selector (daily/weekly/monthly/yearly/custom, prev/next) · cash-flow view with opening/closing balance · safe-to-spend · non-monthly expense provisioning · financial calendar · net worth (assets − liabilities) · behavioral analytics (weekend/payday/small-purchase) · recurring and subscription detection with confirm · receipts/OCR · Quick Add FAB · mobile bottom nav · **offline entry** (Firestore offline persistence isn't enabled) · import/export (CSV/Excel/JSON) with duplicate detection · month-end snapshots · automated tests (**zero tests exist anywhere**) · AI with FACT / PREDICTION / RECOMMENDATION labelling.

## 7. UX problems

- Dashboard answers "how am I doing overall, ever?" rather than "this month"
- Adding a lunch expense needs a full modal with 7 fields, including an irrelevant Frequency picker
- Enterprise pages are styled dark-only (`text-white` on light theme) and visually inconsistent with core pages
- Sidebar has 20+ items. No mobile bottom navigation. No quick-add on mobile.
- Voice assistant results don't actually open the existing transaction form (the `onFormFill` prop is never passed by the route)

## 8. Security problems

- **Firebase web config hard-coded** in `config/firebase.ts` while CI injects `VITE_FIREBASE_*` secrets that are never read. (The Firebase web key isn't secret by design, but this makes env/project switching error-prone.)
- **Firestore security rules aren't in the repo.** Isolation of `users/{uid}/…` can't be verified. **This is the single most important security item to check.**
- `ai-backend` JWT secret defaults and `.env` values should be reviewed (`.env` is gitignored, good).
- No input validation beyond HTML form `min`/`required`. No amount upper bound or date sanity check.
- Gateway simulation: no real OAuth2/OIDC. RBAC exists only in FastAPI.

## 9. Performance problems

- Every dashboard load pulls up to 500 + 500 + 100 + 50 docs and aggregates client-side
- Income/Expense pages call `getAll()` with **no limit, no ordering and no pagination**
- No period-scoped queries (except budget status)
- Insights and health-score recompute the full overview repeatedly (partially mitigated by the in-memory cache)

---

## 10. The blocking architecture decision

Everything after Phase 2 depends on **which system is the source of truth for the new transaction model**:

**Option A: Upgrade within Firestore (recommended for a working product now).**
Keep Vite/React/Firebase and GitHub Pages deployment. Add `transactions`, `accounts`, `recurringRules`, `bills`, `snapshots` subcollections. Migrate existing incomes/expenses/contributions into `transactions` (non-destructive: old collections kept read-only until validated). Firestore gives offline entry and sync almost for free. The FastAPI AI backend can be fed by sending the user's period-scoped aggregates with each AI request (authenticated with a Firebase ID token), so AI answers use real data.

**Option B: Move to PostgreSQL + FastAPI as the brief describes.**
Build the transaction model in Postgres, make FastAPI the system of record, migrate Firestore → Postgres, replace Firebase Auth with the gateway/WSO2 auth, and host the backend somewhere (GitHub Pages can't run it). Matches the brief's enterprise story, but it's much larger, needs hosting, and offline sync has to be hand-built.

**Option C: Hybrid.**
Firestore stays the live store for the PWA. A sync job mirrors transactions into Postgres for AI, analytics and WSO2-integration demos.
