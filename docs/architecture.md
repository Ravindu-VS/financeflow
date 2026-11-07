# FinAI Enterprise — System Architecture Document
## AI-Powered Financial Management SaaS Platform Using WSO2 Technologies

---

## 1. Executive Summary

**FinAI Enterprise** is a production-grade, AI-powered personal financial management SaaS platform that demonstrates enterprise software architecture using the WSO2 technology stack.

**Version:** 2.0.0 | **AI Provider:** Google Gemini 2.0 Flash + RAG Pipeline | **Database:** PostgreSQL 16

---

## 2. WSO2 Product Architecture

### WSO2 API Manager (Port 8080)
- OAuth2/JWT Bearer token validation
- Rate limiting: 100 req/min (default), 20 req/min (AI), 5/5min (reports)
- Role-based scope enforcement
- Real-time API analytics collection

### WSO2 Identity Server (Auth Service)
**Token Types:**
| Token | Expiry | Purpose |
|-------|--------|---------|
| access_token | 30 minutes | API authorization |
| refresh_token | 30 days | Token renewal |
| id_token | 1 hour | User identity (OIDC) |

**User Roles:**
| Role | Permissions |
|------|-------------|
| normal_user | Personal finance, AI advisor, investments |
| financial_advisor | View clients, analyze reports, monitor health |
| admin | Full platform access |

### WSO2 Integrator BI (FastAPI AI Backend)

**AI Features:**
1. **AI Financial Advisor** — RAG pipeline: retrieve user context → build prompt → Gemini LLM → structured JSON response → save insight
2. **ML Expense Prediction** — Linear regression, 12-month history, 3-month forecast ±15% confidence
3. **Financial Health Score (0-100)** — Saving Rate (25%) + Expense Ratio (20%) + Budget Discipline (20%) + Investment (20%) + Emergency Fund (15%)
4. **Fraud Detection** — Z-Score anomaly detection (threshold: 2.5σ) + duplicate detection
5. **Voice NLP** — Web Speech API → regex intent → entity extraction → form prefill

---

## 3. Database Architecture

**PostgreSQL 16 | 17 Tables**

| Table | Purpose |
|-------|---------|
| users | User accounts with roles |
| roles / user_roles | RBAC role management |
| income | Income transactions |
| expenses | Expense transactions (with fraud score) |
| budgets | Category budget limits |
| savings_goals + savings_contributions | Goal tracking |
| investments + portfolios | Portfolio management |
| ai_insights | AI-generated insights storage |
| voice_commands | Voice command audit trail |
| health_scores | Historical health score snapshots |
| reports | Generated report metadata |
| notifications | Multi-channel notification log |
| api_analytics | WSO2 API Manager analytics |
| audit_logs | Security audit trail |
| family_groups | Multi-user family accounts |

---

## 4. Deployment — Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 3000 | React PWA (nginx) |
| gateway | 8080 | WSO2 API Manager simulation |
| ai-backend | 8000 | FastAPI AI/ML + CRUD |
| node-backend | 5000 | Legacy market data |
| postgres | 5432 | Primary database |
| redis | 6379 | Cache + rate limiting |
| prometheus | 9090 | Metrics collection |
| grafana | 3001 | Monitoring dashboards |

---

## 5. Security Layers

```
1. HTTPS/TLS transport
2. CORS origin whitelist
3. JWT validation (WSO2 IS OAuth2 Bearer)
4. Rate limiting (per-user token bucket via Redis)
5. RBAC scope validation (role-based endpoints)
6. Input validation (Pydantic schemas)
7. SQL injection prevention (SQLAlchemy ORM)
8. Audit logging (all mutations)
9. Fraud detection (Z-score anomaly)
```

---

## 6. Technology Stack

| Category | Technology |
|----------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Recharts |
| API Gateway | Node.js/Express (WSO2 AM simulation), http-proxy-middleware |
| Auth | JWT/OIDC pattern (WSO2 IS), bcrypt, jose |
| AI Backend | FastAPI, Python 3.11, SQLAlchemy 2.0 async |
| LLM | Google Gemini 2.0 Flash (primary), OpenAI GPT-4o-mini (fallback) |
| ML | NumPy, scikit-learn, statsmodels |
| NLP | Custom regex pipeline for voice intent extraction |
| Reports | ReportLab (PDF), openpyxl (Excel) |
| Database | PostgreSQL 16, asyncpg |
| Cache | Redis 7 |
| DevOps | Docker, Docker Compose, Kubernetes |
| Monitoring | Prometheus, Grafana |
