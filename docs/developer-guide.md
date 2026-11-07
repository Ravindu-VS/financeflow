# FinAI Enterprise — Developer Setup Guide
## Complete Development Environment Setup

---

## Prerequisites
- Node.js 20+
- Python 3.11+
- Docker Desktop
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)
- Git

---

## Quick Start (Docker — Recommended)

```bash
# 1. Clone and enter project
git clone <repo> finai-enterprise
cd finai-enterprise

# 2. Configure environment
cp .env .env.local
# Edit .env.local — add your Gemini API key!
# GEMINI_API_KEY=your_actual_key_here

# 3. Launch all 8 services
docker-compose up -d

# 4. Check all services are healthy
docker-compose ps

# Services will be available at:
# Frontend:    http://localhost:3000
# API Gateway: http://localhost:8080
# AI Backend:  http://localhost:8000/docs
# Grafana:     http://localhost:3001 (admin / finai_grafana_2024)
# Prometheus:  http://localhost:9090
```

---

## Manual Development Setup

### 1. FastAPI AI Backend

```bash
cd ai-backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env — add DATABASE_URL, GEMINI_API_KEY

# Start PostgreSQL (Docker)
docker run -d --name finai-postgres \
  -e POSTGRES_DB=finai_enterprise \
  -e POSTGRES_USER=finai \
  -e POSTGRES_PASSWORD=finai_secret \
  -p 5432:5432 postgres:16-alpine

# Start Redis (Docker)
docker run -d --name finai-redis -p 6379:6379 redis:7-alpine

# Run migrations (auto on startup)
uvicorn main:app --reload --port 8000

# API docs available at:
# http://localhost:8000/docs  (Swagger UI)
# http://localhost:8000/redoc (ReDoc)
```

### 2. WSO2 API Gateway

```bash
cd gateway

# Install dependencies
npm install

# Configure environment
copy .env.example .env

# Start gateway
npm run dev

# Gateway at: http://localhost:8080
# Analytics:  http://localhost:8080/gateway/analytics
```

### 3. React Frontend

```bash
cd client

# Install dependencies
npm install

# Configure environment (copy enterprise config)
copy .env.enterprise .env.local

# Start development server
npm run dev

# Frontend at: http://localhost:5173
```

### 4. Node.js Legacy Backend (Optional)

```bash
cd server

# Install dependencies
npm install

# Configure MongoDB URI in .env
npm run dev

# Backend at: http://localhost:5000
```

---

## Environment Variables Reference

### Required
```env
GEMINI_API_KEY=           # Get from: https://makersuite.google.com
JWT_SECRET_KEY=           # Any secure random string (32+ chars)
DATABASE_URL=             # PostgreSQL connection string
```

### Optional
```env
OPENAI_API_KEY=           # Fallback LLM provider
REDIS_URL=                # Default: redis://localhost:6379
LLM_PROVIDER=gemini       # 'gemini' or 'openai'
```

---

## API Testing

### Get Auth Token
```bash
# Register
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","first_name":"Test","role":"normal_user"}'

# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

### Test AI Features
```bash
TOKEN="your_access_token_here"

# Financial health score
curl http://localhost:8080/api/v1/health-score/calculate \
  -H "Authorization: Bearer $TOKEN"

# AI advisor chat
curl -X POST http://localhost:8080/api/v1/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "How can I save more money?"}'

# Fraud detection scan
curl http://localhost:8080/api/v1/fraud/scan \
  -H "Authorization: Bearer $TOKEN"

# Generate PDF report
curl -X POST http://localhost:8080/api/v1/reports/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"monthly","format":"pdf","period_start":"2025-01-01","period_end":"2025-01-31"}'

# Voice command
curl -X POST http://localhost:8080/api/v1/voice/process \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Add expense 500 rupees for lunch"}'
```

---

## Project Structure

```
finai-enterprise/
├── client/                    # React PWA Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/            # AI Chat Page
│   │   │   ├── advisor/       # Financial Advisor Portal
│   │   │   ├── enterprise/    # WSO2 Architecture Page
│   │   │   ├── family/        # Family Accounts
│   │   │   ├── health/        # Financial Health Score
│   │   │   ├── reports/       # Report Center
│   │   │   └── voice/         # Voice Assistant
│   │   ├── store/
│   │   │   ├── authStore.ts   # Original Firebase store
│   │   │   └── enterpriseStore.ts  # New JWT/OIDC store
│   │   └── App.tsx            # Updated with enterprise routes
│   └── Dockerfile
│
├── gateway/                   # WSO2 API Manager Simulation
│   └── src/index.js           # JWT validation, rate limiting, proxy
│
├── ai-backend/                # FastAPI AI/ML Backend
│   ├── main.py                # FastAPI app
│   ├── config.py              # Settings
│   ├── models/models.py       # SQLAlchemy ORM models
│   ├── routers/
│   │   ├── auth.py            # OAuth2/OIDC endpoints
│   │   ├── ai_advisor.py      # RAG + Gemini chat
│   │   ├── health_score.py    # Financial health calculation
│   │   ├── predictions.py     # ML expense forecasting
│   │   ├── fraud.py           # Anomaly detection
│   │   ├── voice.py           # NLP intent extraction
│   │   ├── reports.py         # PDF/Excel generation
│   │   └── _all_routers.py   # CRUD routers
│   ├── services/
│   │   ├── llm_service.py     # Gemini + OpenAI integration
│   │   └── report_generator.py # ReportLab + openpyxl
│   ├── core/auth.py           # JWT utilities, RBAC
│   ├── database/
│   │   ├── connection.py      # Async PostgreSQL
│   │   └── schema.sql         # Full schema (17 tables)
│   └── Dockerfile
│
├── server/                    # Legacy Node.js Backend
│   └── src/                  # Existing Express routes
│
├── docs/
│   ├── architecture.md        # This document
│   └── developer-guide.md     # This guide
│
├── monitoring/
│   └── prometheus.yml         # Scrape configuration
│
├── docker-compose.yml         # 8-service orchestration
└── .env                       # Master configuration
```

---

## Monitoring

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001 (admin / finai_grafana_2024)
- **Gateway Analytics:** http://localhost:8080/gateway/analytics
- **AI Backend Health:** http://localhost:8000/health
- **AI Backend Docs:** http://localhost:8000/docs
