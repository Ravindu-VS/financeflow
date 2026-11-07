"""
AI Financial Advisor Router
RAG Pipeline + Google Gemini LLM Integration
Simulates WSO2 Integrator BI intelligent workflow
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, timedelta
import json

from database.connection import get_db
from models.models import User, Income, Expense, Budget, SavingsGoal, Investment, AIInsight, HealthScore
from core.auth import get_current_active_user
from services.llm_service import LLMService

router = APIRouter()
llm_service = LLMService()


class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_history: Optional[List[dict]] = Field(default_factory=list, max_length=40)
    # Client-computed snapshot of the user's ACTUAL transaction data (the PWA's system of
    # record is Firestore). When present it is the primary grounding for the answer.
    financial_context: Optional[Dict[str, Any]] = None


GROUNDING_RULES = """
ANSWERING RULES (mandatory):
- Use ONLY the numbers in the financial data below. Never invent figures, merchants or dates.
- Label every statement as FACT (measured from data), PREDICTION (an estimate, give a range/uncertainty)
  or RECOMMENDATION (state its basis). Use exactly these words in bold.
- Expenses are net of refunds; transfers are not income or expenses; savings and investments are not expenses.
- Investment content is general education and scenario analysis, never personal advice. Never guarantee returns.
- If the data does not contain the answer, say so.
"""


def _context_from_client(ctx: Dict[str, Any]) -> str:
    """Serialise the client snapshot compactly (bounded size) for the prompt."""
    raw = json.dumps(ctx, default=str, separators=(",", ":"))
    return raw[:24000]


class ChatResponse(BaseModel):
    response: str
    insight_type: str
    confidence: float
    model_used: str
    tokens_used: int
    suggestions: List[str]


async def _build_financial_context(user: User, db: AsyncSession) -> str:
    """
    RAG: Retrieves user's financial data to build context for LLM.
    This is the Retrieval step of RAG.
    """
    # Last 3 months data
    three_months_ago = date.today() - timedelta(days=90)

    # Income
    income_result = await db.execute(
        select(Income)
        .where(Income.user_id == user.id, Income.date >= three_months_ago)
        .order_by(desc(Income.date))
        .limit(50)
    )
    incomes = income_result.scalars().all()

    # Expenses
    expense_result = await db.execute(
        select(Expense)
        .where(Expense.user_id == user.id, Expense.date >= three_months_ago)
        .order_by(desc(Expense.date))
        .limit(100)
    )
    expenses = expense_result.scalars().all()

    # Budgets
    budget_result = await db.execute(
        select(Budget).where(Budget.user_id == user.id, Budget.is_active == True)
    )
    budgets = budget_result.scalars().all()

    # Savings goals
    savings_result = await db.execute(
        select(SavingsGoal).where(SavingsGoal.user_id == user.id, SavingsGoal.status == "active")
    )
    savings = savings_result.scalars().all()

    # Investments
    investment_result = await db.execute(
        select(Investment).where(Investment.user_id == user.id, Investment.status == "active")
    )
    investments = investment_result.scalars().all()

    # Latest health score
    health_result = await db.execute(
        select(HealthScore).where(HealthScore.user_id == user.id).order_by(desc(HealthScore.calculated_at)).limit(1)
    )
    health = health_result.scalar_one_or_none()

    # Build context string
    total_income_3m = sum(float(i.amount) for i in incomes)
    total_expenses_3m = sum(float(e.amount) for e in expenses)

    expense_by_category: dict = {}
    for e in expenses:
        expense_by_category[e.category] = expense_by_category.get(e.category, 0) + float(e.amount)

    total_invested = sum(float(i.buy_price * i.quantity) for i in investments if i.quantity)
    portfolio_value = sum(float((i.current_price or i.buy_price) * i.quantity) for i in investments if i.quantity)

    context = f"""
USER FINANCIAL PROFILE:
- Name: {user.first_name} {user.last_name or ''}
- Currency: {user.currency}
- Monthly Income Target: {user.monthly_income or 'Not set'}

LAST 3 MONTHS SUMMARY:
- Total Income: {user.currency} {total_income_3m:,.2f}
- Total Expenses: {user.currency} {total_expenses_3m:,.2f}
- Net Savings: {user.currency} {total_income_3m - total_expenses_3m:,.2f}
- Savings Rate: {((total_income_3m - total_expenses_3m) / total_income_3m * 100) if total_income_3m > 0 else 0:.1f}%

EXPENSE BREAKDOWN BY CATEGORY (last 3 months):
{json.dumps(expense_by_category, indent=2)}

ACTIVE BUDGETS:
{json.dumps([{
    'name': b.name,
    'category': b.category,
    'limit': float(b.limit_amount),
    'spent': float(b.spent_amount),
    'usage_pct': round(float(b.spent_amount) / float(b.limit_amount) * 100, 1)
} for b in budgets], indent=2)}

SAVINGS GOALS:
{json.dumps([{
    'title': s.title,
    'target': float(s.target_amount),
    'saved': float(s.current_amount),
    'progress_pct': round(float(s.current_amount) / float(s.target_amount) * 100, 1),
    'deadline': str(s.target_date) if s.target_date else None
} for s in savings], indent=2)}

INVESTMENT PORTFOLIO:
- Total Invested: {user.currency} {total_invested:,.2f}
- Current Value: {user.currency} {portfolio_value:,.2f}
- P&L: {user.currency} {portfolio_value - total_invested:,.2f}
- Types: {', '.join(set(i.type for i in investments)) if investments else 'None'}

FINANCIAL HEALTH SCORE: {health.score if health else 'Not calculated'}/100 ({health.grade if health else 'N/A'})
"""
    return context


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    request: ChatMessage,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    AI Financial Advisor Chat — RAG Pipeline + LLM
    
    Workflow (WSO2 Integrator BI pattern):
    1. Retrieve financial context (RAG retrieval)
    2. Build augmented prompt
    3. Call LLM (Gemini/OpenAI)
    4. Extract structured response
    5. Save insight to DB
    """
    # Step 1: Retrieve financial context (RAG). Prefer the client's real-data snapshot.
    if request.financial_context:
        financial_context = GROUNDING_RULES + "\nUSER FINANCIAL DATA (JSON, currency LKR):\n" + _context_from_client(request.financial_context)
    else:
        financial_context = GROUNDING_RULES + await _build_financial_context(current_user, db)

    # Step 2: Call LLM with augmented prompt
    result = await llm_service.financial_advisor_chat(
        user_message=request.message,
        financial_context=financial_context,
        conversation_history=request.conversation_history or []
    )

    # Step 3: Save insight to database
    insight = AIInsight(
        user_id=current_user.id,
        type="ai_conversation",
        title=f"Q: {request.message[:100]}",
        content=result["response"],
        confidence=result.get("confidence", 0.85),
        model_used=result.get("model", "gemini"),
        prompt_tokens=result.get("prompt_tokens", 0),
        completion_tokens=result.get("completion_tokens", 0),
        metadata={"question": request.message}
    )
    db.add(insight)
    await db.commit()

    return ChatResponse(
        response=result["response"],
        insight_type=result.get("insight_type", "general"),
        confidence=result.get("confidence", 0.85),
        model_used=result.get("model", "gemini-2.0-flash"),
        tokens_used=result.get("prompt_tokens", 0) + result.get("completion_tokens", 0),
        suggestions=result.get("suggestions", [])
    )


@router.get("/insights")
async def get_ai_insights(
    limit: int = 10,
    insight_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI-generated insights for the user"""
    query = select(AIInsight).where(
        AIInsight.user_id == current_user.id,
        AIInsight.is_dismissed == False
    ).order_by(desc(AIInsight.created_at)).limit(limit)

    if insight_type:
        query = query.where(AIInsight.type == insight_type)

    result = await db.execute(query)
    insights = result.scalars().all()

    return {
        "insights": [
            {
                "id": str(i.id),
                "type": i.type,
                "title": i.title,
                "content": i.content,
                "confidence": float(i.confidence) if i.confidence else 0,
                "model_used": i.model_used,
                "is_acted_on": i.is_acted_on,
                "created_at": i.created_at.isoformat()
            }
            for i in insights
        ]
    }


@router.post("/generate-weekly-insights")
async def generate_weekly_insights(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    WSO2 Integrator BI workflow: Auto-generate weekly financial insights
    """
    financial_context = await _build_financial_context(current_user, db)

    insights = await llm_service.generate_proactive_insights(financial_context)

    saved_insights = []
    for ins in insights:
        insight = AIInsight(
            user_id=current_user.id,
            type=ins.get("type", "spending_analysis"),
            title=ins.get("title", "Financial Insight"),
            content=ins.get("content", ""),
            confidence=ins.get("confidence", 0.80),
            model_used=ins.get("model", "gemini"),
            metadata={"auto_generated": True, "week": str(date.today())}
        )
        db.add(insight)
        saved_insights.append(ins)

    await db.commit()

    return {
        "generated": len(saved_insights),
        "insights": saved_insights,
        "message": "Weekly AI insights generated successfully"
    }
