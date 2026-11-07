# FinAI Enterprise — AI-Powered Financial Management SaaS Platform

> **A WSO2 Internship Portfolio Flagship Project**  
> Enterprise-grade personal finance platform using WSO2 API Manager, WSO2 Identity Server, and WSO2 Integrator BI patterns

---

## 🏆 Project Overview

**FinAI Enterprise** is a full-stack, production-grade financial management SaaS platform that demonstrates every layer of enterprise software architecture:

| Domain | Technology Used |
|--------|----------------|
| **API Management** | WSO2 API Manager (Gateway simulation) |
| **Identity & Security** | WSO2 Identity Server (OAuth2/OIDC/JWT/RBAC) |
| **AI Integration** | Google Gemini 2.0 Flash + RAG Pipeline |
| **Backend** | Firebase (Auth + Firestore, system of record) · FastAPI (Python 3.11) AI layer |
| **Database** | Firestore (offline-first) · PostgreSQL 16 for the AI/reporting layer (Express/MongoDB archived) |
| **Frontend** | React 18 PWA (TypeScript + Tailwind CSS) |
| **DevOps** | Docker Compose (8 services) |
| **Monitoring** | Prometheus + Grafana |

---

## 💳 Transaction-centric model (Nov 2026 upgrade)

Every financial event is an independent **transaction**: lunch today, a sudden vehicle repair, a freelance payment, a gift, a transfer between accounts. **Recurring rules** are optional templates that generate future transactions; editing a rule never rewrites history. The dashboard shows the **current month** by default, and a global period selector (today → year, custom, ← →) drives every screen.

- Accounting model (single source of truth): [`client/src/lib/finance/aggregate.ts`](client/src/lib/finance/aggregate.ts). Transfers are never income or expense; savings and investments are not expenses; refunds reduce expenses.
- New screens: Transactions, Cash Flow, Calendar, Accounts & Net Worth, Planning & Bills, plus Quick Add, Safe-to-Spend and month-end snapshots.
- Existing data upgrades in-app (backup → analyse → upgrade → verified totals). Original records are never modified.
- Full details: [`docs/UPGRADE_REPORT.md`](docs/UPGRADE_REPORT.md) · audit: [`docs/UPGRADE_AUDIT_PHASE1.md`](docs/UPGRADE_AUDIT_PHASE1.md)

```bash
npm ci && npm run dev        # app at http://localhost:3000/financeflow/
npm test                     # 64 financial-logic unit tests
npm run test:e2e             # Playwright end-to-end (see report §18)
firebase deploy --only firestore:rules
```

---

## ✨ Enterprise Features

### 🤖 AI-Powered Features
- **AI Financial Advisor** — Chat with Google Gemini 2.0 Flash using RAG (Retrieval-Augmented Generation) with your actual financial data as context
- **ML Expense Predictions** — Linear regression forecasting of expenses for 3 months ahead with confidence intervals
- **Financial Health Score** — 6-dimension scoring engine (0-100) with A+ to F grades
- **Fraud Detection** — Statistical Z-Score anomaly detection per expense category
- **Voice Assistant** — Web Speech API + NLP for hands-free transaction entry

### 🛡️ Enterprise Security (WSO2 IS Pattern)
- OAuth2 / OpenID Connect token flow
- JWT access tokens (30min) + refresh tokens (30 days) + id_token (OIDC)
- Role-Based Access Control: `normal_user`, `financial_advisor`, `admin`
- Per-request JWT validation at the API Gateway layer

### 🌐 WSO2 API Manager (Gateway)
- Centralized entry point for all API traffic
- Rate limiting: 100 req/min (default) / 20 req/min (AI) / 5 req/5min (reports)
- Real-time API analytics dashboard
- RBAC scope enforcement (advisor-only endpoints)
- Request proxy routing to backend microservices

### 📊 Financial Management
- Income tracking (recurring, categories, sources)
- Expense tracking with merchant, payment method, fraud flagging
- Budget management with real-time overspend alerts
- Savings goals with contribution tracking
- Investment portfolio (stocks, crypto, FD, gold, mutual funds)

### 📑 Enterprise Reports
- PDF reports using ReportLab (professional enterprise formatting)
- Excel reports using openpyxl (with multiple sheets)
- CSV data exports

### 👨‍👩‍👧‍👦 Multi-User Features
- Financial Advisor portal (view assigned clients, monitor health)
- Family group accounts (shared wallets)

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone repository
git clone <repo> finai-enterprise
cd finai-enterprise

# Configure API keys
cp .env .env.local
# Edit .env and add: GEMINI_API_KEY=your_key

# Launch all 8 services
docker-compose up -d

# Open app
open http://localhost:3000
```

**Services available after launch:**
| Service | URL |
|---------|-----|
| 🖥️ Frontend (React PWA) | http://localhost:3000 |
| 🌐 API Gateway | http://localhost:8080 |
| 🤖 AI Backend (Swagger) | http://localhost:8000/docs |
| 📊 Grafana | http://localhost:3001 |
| 📡 Prometheus | http://localhost:9090 |
| 🔌 Gateway Analytics | http://localhost:8080/gateway/analytics |

### Option 2: Manual Development

```bash
# 1. Start PostgreSQL + Redis (Docker)
docker run -d --name finai-pg -e POSTGRES_DB=finai_enterprise -e POSTGRES_USER=finai -e POSTGRES_PASSWORD=finai_secret -p 5432:5432 postgres:16-alpine
docker run -d --name finai-redis -p 6379:6379 redis:7-alpine

# 2. AI Backend
cd ai-backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3. API Gateway
cd gateway
npm install && npm run dev  # Port 8080

# 4. Frontend
cd client
npm install && npm run dev   # Port 5173
```

---

## 📁 Project Structure

```
finai-enterprise/
├── client/                     # React 18 PWA (TypeScript)
│   └── src/
│       ├── components/
│       │   ├── ai/             # 🤖 AI Advisor Chat
│       │   ├── advisor/        # 👔 Financial Advisor Portal
│       │   ├── enterprise/     # 🏗️ WSO2 Architecture Visualization
│       │   ├── family/         # 👨‍👩‍👧‍👦 Family Accounts
│       │   ├── health/         # ❤️ Financial Health Score
│       │   ├── reports/        # 📑 Report Center
│       │   └── voice/          # 🎙️ Voice Assistant
│       └── store/
│           ├── authStore.ts    # Legacy Firebase auth
│           └── enterpriseStore.ts  # NEW: JWT/OIDC store
│
├── gateway/                    # WSO2 API Manager Simulation (Node.js)
│   └── src/index.js            # JWT + rate limiting + proxy
│
├── ai-backend/                 # FastAPI AI Backend (Python 3.11)
│   ├── routers/
│   │   ├── auth.py             # OAuth2/OIDC endpoints
│   │   ├── ai_advisor.py       # Gemini RAG pipeline
│   │   ├── health_score.py     # Financial health engine
│   │   ├── predictions.py      # ML forecasting
│   │   ├── fraud.py            # Anomaly detection
│   │   ├── voice.py            # NLP intent extraction
│   │   ├── reports.py          # PDF/Excel generation
│   │   └── _all_routers.py     # CRUD routers
│   └── services/
│       ├── llm_service.py      # Gemini + OpenAI integration
│       └── report_generator.py # ReportLab + openpyxl
│
├── server/                     # Legacy Node.js/Express backend
├── monitoring/                 # Prometheus + Grafana config
├── docs/                       # Architecture + developer docs
├── docker-compose.yml          # 8-service orchestration
└── .env                        # Master configuration
```

---

## 🌐 API Endpoints

Full documentation at: `http://localhost:8000/docs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Register new user |
| `POST` | `/api/v1/auth/login` | Get JWT tokens |
| `POST` | `/api/v1/ai/chat` | Chat with AI advisor |
| `GET`  | `/api/v1/health-score/calculate` | Calculate health score |
| `GET`  | `/api/v1/fraud/scan` | Scan for anomalies |
| `GET`  | `/api/v1/predictions/expenses` | ML expense forecast |
| `POST` | `/api/v1/voice/process` | Process voice command |
| `POST` | `/api/v1/reports/generate` | Generate PDF/Excel |
| `GET`  | `/api/v1/advisor/clients` | Advisor: view clients |

---

## 🔐 Security

- All API calls validated via JWT at Gateway layer
- Passwords hashed with bcrypt (12 rounds)
- SQL injection prevented by SQLAlchemy ORM
- Input validated by Pydantic schemas
- Rate limiting prevents abuse
- CORS configured to whitelist only frontend origins
- Audit logging for all data modifications

---

## 🧪 Test Credentials

After running, register a user at `http://localhost:3000/register`:
- **Normal User:** Any email/password
- **Financial Advisor:** Select "Financial Advisor" role during registration

---

## 📊 WSO2 Demonstrating Skills

This project demonstrates the following WSO2-relevant skills:

| WSO2 Product | Demonstrated |
|---|---|
| WSO2 API Manager | API gateway, rate limiting, analytics, OAuth2 enforcement |
| WSO2 Identity Server | OAuth2/OIDC, JWT, RBAC, role management |
| WSO2 Integrator BI | AI workflow automation, report generation, data integration |
| WSO2 Micro Integrator | Service composition (income, expense, investment services) |
| Enterprise Integration | Multiple backend service orchestration |
| API Security | Token validation, scope-based access control |

---

## 📈 Technology Stack

```
Frontend:   React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Recharts
Gateway:    Node.js · Express · JWT · Rate Limiting · http-proxy-middleware
Backend:    FastAPI · Python 3.11 · SQLAlchemy 2.0 async · Pydantic v2
AI/ML:      Google Gemini 2.0 Flash · OpenAI GPT-4o-mini · NumPy · scikit-learn
NLP:        Custom regex-based intent extraction
Reports:    ReportLab (PDF) · openpyxl (Excel)
Database:   PostgreSQL 16 · asyncpg · Redis 7
DevOps:     Docker · Docker Compose · Prometheus · Grafana
Auth:       JWT/OIDC (WSO2 IS pattern) · bcrypt · python-jose
```

---

*Built as a WSO2 Internship Portfolio Project — Ravindu VS*
