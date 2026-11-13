# FinanceFlow — Transaction-Centric Upgrade Report

**Date:** 2026-11-07 · **Scope:** Phases 1–15 of the upgrade brief · **Companion:** [`UPGRADE_AUDIT_PHASE1.md`](UPGRADE_AUDIT_PHASE1.md) (the read-only audit)

**Architecture decision (made with the project owner):** Firebase **Firestore stays the system of record** for the PWA. The FastAPI + PostgreSQL backend is kept as the enterprise AI / reporting layer, and now gets real user data through a client-computed context. The idle Express + MongoDB server was archived.

---

## 1. Current architecture

```
Vite + React 18 + TS PWA (GitHub Pages, /financeflow/)
 ├─ Firebase Auth (email, Google)
 ├─ Firestore — offline-first (IndexedDB cache, multi-tab), per-user subcollections:
 │    transactions · accounts · recurringRules · snapshots · meta/{settings,migration} · auditLogs
 │    budgets · savingsGoals · investments (holdings)   [legacy, read-only: incomes · expenses]
 ├─ src/lib/finance — pure, unit-tested domain engine (accounting, periods, recurrence,
 │    forecasts, safe-to-spend, behaviour analytics, detection, import/export, migration, AI grounding)
 └─ Enterprise layer (optional, local / docker-compose):
      gateway/ (WSO2 API Manager simulation: JWT, rate limiting, analytics)
        → ai-backend/ (FastAPI: LLM chat, voice NLP, reports, predictions) → PostgreSQL
```

**Principle enforced in code:** *Track actual money first. Plan future money second.* Transactions are facts. Recurring rules, budgets and provisions are plans. Forecasts are estimates. AI answers are labelled FACT / PREDICTION / SUGGESTION.

## 2. Problems discovered

See the audit for full detail. Headlines:

- Income and expenses were modelled as recurring-frequency records. The frequency was cosmetic: nothing ever generated occurrences, and one-time entries were saved with `recurringFrequency: 'monthly'`.
- The dashboard showed **lifetime** totals with **hard-coded** trend percentages.
- Three disconnected backends. The enterprise pages (AI, voice, reports) used a JWT that Firebase users never receive, so they couldn't reach the user's data.
- `npm run build` failed (missing type declarations), so the next GitHub Pages deploy would have failed.
- There were no accounts or transfers, savings and investments never moved money, and there were zero tests.

## 3. Bugs fixed

| Bug (audit #) | Fix |
|---|---|
| B1 lifetime dashboard totals | Dashboard is period-scoped; defaults to the current month |
| B2 fake trend % | Real comparisons; like-for-like while a period is in progress (Nov 1–7 vs Oct 1–7) |
| B3 "this month" breakdown was lifetime | Uses the selected period |
| B4 empty Recent Transactions | Populated from period transactions |
| B5 totals truncated at 500 docs | Range queries per period; 13-month live window; older periods queried on demand |
| B6 avgDaily = lifetime/30 | Removed; daily limit derives from safe-to-spend ÷ days left |
| B7 cache TTL ignored | Per-entry TTL (and analytics no longer depend on that cache) |
| B8 month filter did nothing | Global period selector drives every list |
| B9 "Essential" never matched | `isEssential` flag per transaction (defaults from category) |
| B10 "Income sources" counted records | Counts distinct categories |
| B11 frequency saved on one-time items | Recurrence is a separate rule, created only when "This repeats" is ticked |
| B12 health score NaN / net-worth double count | Transparent score with guards; net worth = assets − liabilities + holdings at market value |
| B13 "week" trend returned months | Real daily / weekly / monthly / yearly views |
| B14 UTC date shifting | All dates are local `YYYY-MM-DD` keys; legacy UTC-midnight timestamps are recovered correctly (tested in 4 timezones) |
| B15 ROI ÷ 0 | Guarded in the new analytics |
| B16 401 redirect ignored basename | Dead file archived |
| B17 **build broken** | Added `vite-env.d.ts` (env + Web Speech typings); `tsc` and `vite build` pass |
| B18/B19 AI and voice couldn't use real data | Voice parses on-device. AI chat sends a real-data context to FastAPI, or answers on-device when the backend isn't available. |
| B20 hard-coded Indian products with return figures | Removed; recommendations state their basis and say they are not personal advice |
| — **XSS** in AI chat (`dangerouslySetInnerHTML` on LLM output) | Output is HTML-escaped before markdown formatting |
| — Silent listener failures | Firestore listeners now have error handlers; timestamps are normalised defensively (found by the E2E tests) |
| — Forecast extrapolated one-off spending | One-time, unexpected and emergency items are counted once and never projected forward (found during visual review) |

## 4. Features added

- **Unified transaction model**: 10 types (income, expense, transfer, investment, withdrawal, savings contribution and withdrawal, refund, reimbursement, adjustment). Fields include account, merchant, tags, receipt, status, source, kind (one-time / regular / unexpected / emergency) and nature (fixed / variable). Recurrence is optional.
- **Quick Add** floating button (Expense / Income / Investment / Savings / Transfer / Bill / Voice). An expense needs only amount + category; date defaults to today and the account to your bank. Shows a duplicate warning and validation messages.
- **Global period selector** (Today … Last Year, Custom, ← →). Default is This Month.
- **Monthly dashboard**: Income, Expenses, Savings, Investments, Net Cash Flow, Remaining Budget, Safe-to-Spend, Budget Status with forecast, labelled Insights, Expense Breakdown, Spending Trend, Recent Transactions, Upcoming Bills (with "Paid"), Savings Progress, Financial Health, Net Worth.
- **Transactions** page: search plus filters (type, category, account, amount range, payment method, tag, source, recurring), day-grouped daily view, and CSV/JSON import and export. Income and Expenses pages reuse it.
- **Accounts & Net Worth**: 11 account types, opening balances, liabilities, archived accounts, transfers, "recalculate balances", and a trend from month-end snapshots.
- **Cash Flow**: opening → income / refunds / expenses / savings / investments / transfers → closing (proven to balance), waterfall chart, available cash over time.
- **Financial Calendar**: actual daily in/out, planned bills and recurring items, goal deadlines.
- **Planning & Bills**: recurring rules (daily → annual + custom; start/end; auto-record or reminder; skip next; pause; edit future only), upcoming 30 days, **non-monthly provisions** (Rs. 60,000/year → Rs. 5,000/month, never recorded as an expense), recurring/subscription **detection with accept/reject**, planning settings (emergency reserve, savings and investment targets, 5 budgeting approaches), and a data-quality report.
- **Budgets**: budgeted vs actual vs forecast, scaled to the selected period, alert thresholds, unbudgeted spending.
- **Insights**: forecast range with confidence; facts, predictions and suggestions with their basis; behaviour (weekend vs weekday, payday, small purchases, unexpected, spikes, income variability, saving/investing consistency).
- **Analytics**: daily / weekly / monthly / yearly, previous-period comparison, averages, category trends, weekday pattern.
- **Reports**: period report → PDF (print), summary CSV (opens in Excel), transactions CSV, JSON.
- **Month-end snapshots**: written lazily on app open for each completed month.
- **Offline**: Firestore persistent cache, queued writes, Offline / Syncing indicator, "Saved offline" confirmation.
- **Mobile**: bottom navigation, large touch targets, camera receipt capture (compressed and stored with the transaction).

## 5. Database changes

**Firestore** (system of record; non-destructive):

- New collections: `transactions`, `accounts` (with an incrementally maintained `balance`), `recurringRules`, `snapshots`, `meta/settings`, `meta/migration`, `auditLogs`.
- Legacy collections are left untouched. New savings contributions and investments carry a `txId` so they are never migrated twice.
- **`firestore.rules`** (new) adds per-user isolation, server-side validation of transactions (type, amount bounds, date format, status, source, field sizes) and append-only audit logs.

**PostgreSQL** (enterprise layer): `ai-backend/database/migrations/001_transaction_model.sql` adds:

- `accounts`, `recurring_rules`, `transactions`, `financial_snapshots`
- the `mv_monthly_summary` materialized view
- indexes on (user, date) and (user, type, date)
- a unique constraint preventing duplicate recurring occurrences, plus CHECK constraints (positive amounts, valid transfers)
- an idempotent data copy with built-in totals validation that **rolls back on mismatch**

## 6. API changes

- `POST /api/v1/ai/chat` accepts an optional `financial_context`, the client's real-data snapshot. When present, it is the grounding for the LLM. Grounding rules are prepended to every prompt: use only the given numbers, label FACT / PREDICTION / RECOMMENDATION, never guarantee returns. Input is size-limited (message ≤ 2,000 chars, history ≤ 40 turns).
- The client data layer is `services/financeService.ts` (transactions, accounts, recurring, settings, snapshots, migration) plus `services/transactionActions.ts` (side effects on goals, holdings and bills).

## 7. Frontend changes

- **New:** `lib/finance/*`, `hooks/useFinance.ts`, `store/{financeStore,periodStore,quickAddStore}.ts`, `components/finance/*` (PeriodSelector, TransactionForm, QuickAdd, TransactionList, MigrationBanner), and pages for Transactions, Cash Flow, Calendar, Accounts, Planning and the Period Report.
- **Rewritten on the new model:** Dashboard, Income, Expenses, Budgets, Analytics, Insights.
- **Updated:** Savings (contributions become transactions), Investments (purchases become transactions), Voice, AI Chat, Reports, Layout, App routes, Firebase config (env vars + offline cache).
- **Archived** to `_archive/`: `services/api.ts`, `pages.ts`, `store/dashboardStore.ts`, and the Express/MongoDB `server/`. Removed the buggy lifetime `analyticsService` and `insightsService`.

## 8. WSO2 changes

- Architecture preserved. The AI chat request carries real data through the gateway when an enterprise session exists.
- **Honest note:** WSO2 is still a *simulation* (`gateway/`). The PWA's own data traffic goes straight to Firestore, protected by Firebase Auth and Firestore rules, so it does not pass through the gateway. Routing it through WSO2 would need a real WSO2 deployment and a Firebase-token → WSO2 token exchange (see §16).

## 9. AI changes

- Real-data grounding (`buildFinancialContext`): current and previous month, categories, income sources, forecast, safe-to-spend, budgets, goals, behaviour, rule-based insights.
- On-device answers (`answerLocally`) for the 9 example questions in the brief when offline or without a backend. Every answer is labelled FACT / PREDICTION / SUGGESTION and states its basis.
- Predictions show a range and a confidence level. Investment content is education only.

## 10. Voice changes

- The on-device parser works offline and needs no backend. It handles amounts (incl. "1.5 lakhs", "Rs. 3,500"), dates (today, yesterday, "N days ago"), all transaction types, categories and the "unexpected" flag.
- Pipeline: speech → text → intent/entities → **preview** → **existing transaction form** → user confirms → database (`source: voice`). Nothing is saved without confirmation.
- Answers questions such as "How much did I spend this week?" from real data.
- Recognition language is `en-LK`. The backend NLP is used only as a fallback when local confidence is low.

## 11. Migration results

**How it runs:** in-app, per user. The banner walks through 1) download a JSON backup, 2) analyse (counts and totals before/after), 3) upgrade, 4) automatic read-back verification. The result is saved to `meta/migration`.

**Mapping rules:**

- Each income, expense, savings contribution and investment purchase becomes one transaction with a deterministic id.
- Legacy "recurring" items become **reminder-only** rules (`autoGenerate: false`). Nothing starts auto-posting without the user's consent.
- Categories are normalised and invalid rows are skipped and reported.

**Verified results:**

- **Unit:** totals before == after; idempotent (same ids on re-run); one-time items carry no recurrence.
- **E2E:** 6 legacy records → 6 verified transactions; legacy docs unchanged; account balance exactly correct (Rs. 43,700 after the follow-up entries).
- **PostgreSQL** (real Postgres 16, seeded data, run twice): income 195,000.00 / expenses 29,850.50 / savings 5,000.00 / investments 39,550.00. Before == after, diff = 0, no duplicates on re-run. The transfer, positive-amount and duplicate-occurrence constraints were each confirmed to reject bad rows.

**Not yet run:** the migration on your **production** Firestore data. That happens when you open the deployed app and click through the banner. Download the backup first; it's step 1.

## 12. Testing results

| Suite | Result |
|---|---|
| Unit — `npm test` (Vitest, `lib/finance`) | **91 / 91 pass.** Accounting model, periods, recurrence & idempotency, migration, import/export, multi-currency, plus the new engines: receipt parser (totals, day-first dates, merchants, items), Holt forecasting & intervals, anomaly detection, all five budget methods, investment advisor (emergency-fund gate, allocation, future value, ROI), alert rules, concurrent-edit resolution. |
| E2E — `npm run test:e2e` (Playwright + Chrome, real UI, in-memory Firebase) | **4 / 4 pass**, zero console errors: (1) migration → quick add → custom category → transfer → balances → periods → voice → AI; (2) recurring generation idempotent; (3) offline entry; (4) notification centre (budget + unusual expense, dismiss persists), zero-based plan, 3-month forecast + anomalies, investment advisor (risk profile saved), service-status panel, concurrent edit on two devices → conflict reported, other device's value kept. |
| Backend — `pytest` (FastAPI on real PostgreSQL 16) | **11 / 11 pass**: health with real DB check, token rejection, Firebase user provisioning, sync upsert/mirror/delete/idempotency/currency, per-user isolation, validation, AI never invents numbers, voice, `/auth/me` roles, PDF/XLSX/CSV reports returned inline, health score from synced data. A smoke run of **every** GET endpoint returns 200 (advisor endpoints 403 for non-advisors, as intended). |
| Gateway — `npm test` (Node, end-to-end through the backend) | **4 / 4 pass**: health aggregation, unauthenticated/foreign-project tokens rejected, POST bodies proxied with full path, rate-limit headers. |
| Type check / production build / clean `npm ci` | Pass. Heavy on-demand libraries (Excel/PDF/OCR) are excluded from the PWA precache (1.8 MB). |

Bugs found and fixed by the new backend tests: report router crashed on a read-only filesystem at import; `ai_insights`/`reports`/`audit_logs`/`notifications` models pointed at a non-existent `extra_data` column; `/voice/history` missing import; health score `KeyError` when no budgets exist.

## 13. Security results

- **Added:**
  - Firestore rules with per-user isolation, validation of financial writes, append-only audit log, and default deny.
  - XSS fix in the AI chat.
  - CSV export neutralises spreadsheet formula injection.
  - Import validates every row before writing.
  - Receipt uploads are images only, ≤ 15 MB input, compressed, and capped below the Firestore document limit.
  - Every write records an audit-log entry.
  - AI request size limits.
- **Action required:** deploy the rules with `firebase deploy --only firestore:rules`. They are **not active until deployed**, and I couldn't verify what rules are live today.
- The Firebase web config is public by design; access control is the rules. Config now comes from `VITE_FIREBASE_*`, with the old values as fallback.

## 14. Performance results

- Dashboard no longer downloads all history. One live subscription covers a 13-month window, older periods use a single date-range query, and there is no composite-index requirement.
- Balances are maintained incrementally, so there is no full scan.
- Snapshots make month-over-month views cheap.
- Postgres gets an aggregation MV and (user, date) indexes.
- Production bundle: new pages are lazy-loaded at 6–17 kB gzip each. Firebase (131 kB gzip) and charts (114 kB gzip) are unchanged vendor chunks.

## 15. Hosted services (all online)

| Service | Where | Notes |
|---|---|---|
| PWA (frontend) | GitHub Pages `ravindu-vs.github.io/financeflow` | Built and deployed by GitHub Actions on every push to `main` (tests + type check gate the deploy). |
| Firestore + Firebase Auth | Firebase project `financeflow-a6aa0` | System of record; offline-first. |
| API Gateway (WSO2-pattern) | Vercel project `financeflow-gateway` | Verifies Firebase ID tokens (Google certs), API keys, rate limits, request ids, analytics, `/gateway/health` aggregates real upstream status. |
| AI Backend (FastAPI) | Vercel project `financeflow-api` (Python, region bom1) | Firebase-token auth, Firestore→PostgreSQL sync, Gemini AI chat/insights, reports, health score, predictions, fraud, voice. |
| PostgreSQL | Supabase `tpaderdqsjhcgqsvsqjv` (ap-south-1), Supavisor pooler | Schema + migrations 001/002, RLS on every table, dedicated least-privilege role `finai_backend`. |
| LLM | Google Gemini (`gemini-2.5-flash`) | Key stored only as an encrypted Vercel env var. `/health` verifies the key against the Gemini API. |

Data flow: the app writes to Firestore → auto-sync (debounced, and on reconnect) pushes the rolling 13-month window to `POST /api/v1/sync/firestore` through the gateway → backend upserts by Firestore id, mirrors income/expenses and removes deleted rows. Every feature still works on-device if a service is unreachable (AI falls back to your own Gemini key, then to on-device answers).

Settings → **Services & AI** shows live status of every service, last sync and a "Sync now" button.

## 16. Remaining limitations

1. WSO2 itself (APIM/IS) is not hosted — the gateway implements the same policies (token validation, throttling, analytics) as a Node service.
2. Rate limiting is per serverless instance (no hosted Redis).
3. OCR runs on-device (Tesseract); the first scan downloads the English model (~10 MB) and needs a connection.
4. Market pages show sample data.

## 17. Exact commands to run the project

```bash
# from the repo root
npm ci                       # installs the client workspace
npm run dev                  # http://localhost:3000/financeflow/  (uses live Firebase)

# optional enterprise layer
docker compose up -d postgres redis ai-backend gateway
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ai-backend/database/migrations/001_transaction_model.sql
```

## 18. Exact commands to run tests

```bash
npm test                         # 91 unit tests (Vitest)
npm run typecheck
npm run build
cd client && npx playwright install chromium && npm run test:e2e   # 4 E2E tests

# backend (needs PostgreSQL with database/schema.sql + migrations 001, 002)
cd ai-backend && pip install -r requirements.txt -r requirements-dev.txt
DATABASE_URL=postgresql://user@localhost:5432/finai_test ENVIRONMENT=test pytest -q    # 11 tests
# gateway (backend running on :8000)
cd gateway && npm ci && AI_BACKEND_URL=http://127.0.0.1:8000 npm test           # 4 tests
#   or with a local Chrome:  PW_CHROME_PATH=/path/to/chrome npm run test:e2e
```

## 19. Deployment instructions

1. Back up Firestore: `gcloud firestore export gs://<bucket>/backup-$(date +%F)`. Each user's in-app migration also downloads a personal JSON backup.
2. `firebase deploy --only firestore:rules` (uses `/firestore.rules`).
3. **Add the test gate to CI (manual — the workflow file couldn't be written remotely).** In `.github/workflows/deploy.yml`, after the `Install dependencies` step, add:
   ```yaml
         - name: Unit tests (financial calculations, recurrence, migration, import/export)
           run: npm test

         - name: Type check
           run: npm run typecheck
   ```
   Then commit and push to `main`. GitHub Actions runs `npm ci` → unit tests → type check → build → deploys `client/dist` to GitHub Pages.
4. Open the app. Each existing user sees the upgrade banner once: backup → analyse → upgrade.
5. Optional: run the SQL migration on the enterprise Postgres (back up with `pg_dump -Fc` first).

## 20. Updated documentation

- `docs/UPGRADE_AUDIT_PHASE1.md`: audit
- `docs/UPGRADE_REPORT.md`: this report
- `firestore.rules`: commented security rules
- `ai-backend/database/migrations/001_transaction_model.sql`: commented migration
- `client/src/lib/finance/aggregate.ts`: header documents the accounting model used everywhere
- `README.md`: new "Transaction model" section and commands
