"""
FinAI Enterprise — FastAPI Main Application
WSO2 Enterprise Financial Management SaaS Platform
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import logging

from database.connection import engine, Base
from config import settings

# Import all routers
from routers import (
    auth, income, expenses, budgets, savings,
    investments, reports, ai_advisor, predictions,
    health_score, fraud, voice, analytics, advisor, family
)
from routers.sync import router as sync_router
from sqlalchemy import text

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("finai-enterprise")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("🚀 FinAI Enterprise starting up...")
    # Schema is managed by SQL migrations (database/schema.sql + migrations/). create_all only
    # fills gaps in local development; on serverless it is skipped to keep cold starts fast.
    if not settings.is_serverless:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("✅ Database tables ready")
        except Exception as e:  # never block startup on DDL
            logger.warning(f"create_all skipped: {e}")
    logger.info(f"🤖 LLM Provider: {settings.LLM_PROVIDER}")
    yield
    logger.info("🛑 FinAI Enterprise shutting down...")


app = FastAPI(
    title="FinAI Enterprise API",
    description="""
## AI-Powered Financial Management SaaS Platform

Built with **WSO2 enterprise architecture** principles:
- 🛡️ **WSO2 API Manager** — API gateway, rate limiting, analytics
- 🔐 **WSO2 Identity Server** — OAuth2/OIDC, RBAC, JWT
- 🧠 **WSO2 Integrator BI** — AI workflows, intelligent automation
- 🤖 **Google Gemini AI** — RAG pipeline, financial advisor
- 📊 **ML Predictions** — Expense forecasting, anomaly detection
- 🎙️ **Voice AI** — Natural language financial commands

**User Roles:** Normal User | Financial Advisor | Admin
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# ─── Middleware ──────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Track request processing time for API analytics"""
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = str(round(process_time, 2))
    response.headers["X-Powered-By"] = "FinAI Enterprise / WSO2"
    return response


# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["Authentication"])
app.include_router(income.router,      prefix="/api/v1/income",      tags=["Income"])
app.include_router(expenses.router,    prefix="/api/v1/expenses",    tags=["Expenses"])
app.include_router(budgets.router,     prefix="/api/v1/budgets",     tags=["Budgets"])
app.include_router(savings.router,     prefix="/api/v1/savings",     tags=["Savings"])
app.include_router(investments.router, prefix="/api/v1/investments", tags=["Investments"])
app.include_router(reports.router,     prefix="/api/v1/reports",     tags=["Reports"])
app.include_router(ai_advisor.router,  prefix="/api/v1/ai",          tags=["AI Financial Advisor"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["ML Predictions"])
app.include_router(health_score.router,prefix="/api/v1/health-score",tags=["Financial Health Score"])
app.include_router(fraud.router,       prefix="/api/v1/fraud",       tags=["Fraud Detection"])
app.include_router(voice.router,       prefix="/api/v1/voice",       tags=["Voice Assistant"])
app.include_router(analytics.router,   prefix="/api/v1/analytics",   tags=["Analytics"])
app.include_router(advisor.router,     prefix="/api/v1/advisor",     tags=["Financial Advisor Portal"])
app.include_router(family.router,      prefix="/api/v1/family",      tags=["Family Accounts"])
app.include_router(sync_router,        prefix="/api/v1/sync",        tags=["Firestore Sync"])


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    """Real dependency checks (used by the app's service status panel)."""
    db_status, db_latency = "offline", None
    try:
        t0 = time.time()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status, db_latency = "online", round((time.time() - t0) * 1000)
    except Exception as e:
        logger.error(f"DB health check failed: {e}")
    from services.llm_service import llm_service
    llm = await llm_service.check_health()
    return {
        "status": "healthy" if db_status == "online" else "degraded",
        "service": "FinAI Enterprise AI Backend",
        "version": "2.1.0",
        "components": {
            "database": {"status": db_status, "engine": "PostgreSQL", "latency_ms": db_latency},
            "llm": {**llm, "provider": settings.LLM_PROVIDER, "model": settings.GEMINI_MODEL if settings.LLM_PROVIDER == "gemini" else settings.OPENAI_MODEL},
            "auth": {"status": "online", "providers": ["firebase", "jwt"]},
        },
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "FinAI Enterprise API v2.0",
        "docs": "/docs",
        "health": "/health",
        "powered_by": "WSO2 Enterprise Architecture + Google Gemini AI"
    }
