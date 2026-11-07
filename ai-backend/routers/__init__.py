"""
Routers package
All routers expose a .router attribute (FastAPI APIRouter instance)
"""
from routers.ai_advisor import router as ai_advisor_router
from routers.predictions import router as predictions_router
from routers.health_score import router as health_score_router
from routers.fraud import router as fraud_router
from routers.voice import router as voice_router
from routers.reports import router as reports_router
from routers.auth import router as auth_router
from routers._all_routers import (
    income_router,
    expense_router,
    budget_router,
    savings_router,
    investment_router,
    analytics_router,
    advisor_router,
    family_router,
)

# Expose with .router attribute for main.py
class _RouterWrapper:
    def __init__(self, r): self.router = r

auth        = _RouterWrapper(auth_router)
income      = _RouterWrapper(income_router)
expenses    = _RouterWrapper(expense_router)
budgets     = _RouterWrapper(budget_router)
savings     = _RouterWrapper(savings_router)
investments = _RouterWrapper(investment_router)
reports     = _RouterWrapper(reports_router)
ai_advisor  = _RouterWrapper(ai_advisor_router)
predictions = _RouterWrapper(predictions_router)
health_score= _RouterWrapper(health_score_router)
fraud       = _RouterWrapper(fraud_router)
voice       = _RouterWrapper(voice_router)
analytics   = _RouterWrapper(analytics_router)
advisor     = _RouterWrapper(advisor_router)
family      = _RouterWrapper(family_router)
