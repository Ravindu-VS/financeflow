"""Income, Expenses, Budgets, Savings, Investments, Analytics, Advisor, Family routers"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

from models.models import (
    User, Income, Expense, Budget, SavingsGoal, SavingsContribution,
    Investment, Notification, HealthScore
)
from database.connection import get_db
from core.auth import get_current_active_user, require_advisor

# ─── Income Router ────────────────────────────────────────────────────────────
income_router = APIRouter()

class IncomeCreate(BaseModel):
    title: str
    amount: float
    source: str
    category: Optional[str] = None
    description: Optional[str] = None
    date: date
    is_recurring: bool = False
    recurrence_type: Optional[str] = None
    tags: Optional[List[str]] = []

@income_router.post("/", status_code=201)
async def create_income(data: IncomeCreate, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    income = Income(user_id=user.id, **data.dict())
    db.add(income)
    await db.commit()
    await db.refresh(income)
    return {"id": str(income.id), "message": "Income added successfully"}

@income_router.get("/")
async def get_income(
    page: int = 1, limit: int = 20,
    source: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Income).where(Income.user_id == user.id)
    if source: query = query.where(Income.source == source)
    if start_date: query = query.where(Income.date >= start_date)
    if end_date: query = query.where(Income.date <= end_date)
    query = query.order_by(desc(Income.date)).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    incomes = result.scalars().all()
    
    total_result = await db.execute(select(func.sum(Income.amount)).where(Income.user_id == user.id))
    total = float(total_result.scalar() or 0)
    
    return {
        "income": [{"id": str(i.id), "title": i.title, "amount": float(i.amount), "source": i.source, "date": str(i.date), "is_recurring": i.is_recurring} for i in incomes],
        "total": total,
        "currency": user.currency
    }

@income_router.delete("/{income_id}")
async def delete_income(income_id: str, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Income).where(Income.id == income_id, Income.user_id == user.id))
    income = result.scalar_one_or_none()
    if not income: raise HTTPException(404, "Income not found")
    await db.delete(income)
    await db.commit()
    return {"message": "Income deleted"}


# ─── Expense Router ───────────────────────────────────────────────────────────
expense_router = APIRouter()

class ExpenseCreate(BaseModel):
    title: str
    amount: float
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None
    date: date
    payment_method: Optional[str] = None
    merchant: Optional[str] = None
    is_recurring: bool = False
    tags: Optional[List[str]] = []

@expense_router.post("/", status_code=201)
async def create_expense(data: ExpenseCreate, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    expense = Expense(user_id=user.id, **data.dict())
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return {"id": str(expense.id), "message": "Expense added"}

@expense_router.get("/")
async def get_expenses(
    page: int = 1, limit: int = 20,
    category: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Expense).where(Expense.user_id == user.id)
    if category: query = query.where(Expense.category == category)
    if start_date: query = query.where(Expense.date >= start_date)
    if end_date: query = query.where(Expense.date <= end_date)
    query = query.order_by(desc(Expense.date)).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    expenses = result.scalars().all()
    
    total_result = await db.execute(select(func.sum(Expense.amount)).where(Expense.user_id == user.id))
    total = float(total_result.scalar() or 0)
    
    return {
        "expenses": [{"id": str(e.id), "title": e.title, "amount": float(e.amount), "category": e.category, "date": str(e.date), "merchant": e.merchant, "is_flagged": e.is_flagged} for e in expenses],
        "total": total,
        "currency": user.currency
    }

@expense_router.delete("/{expense_id}")
async def delete_expense(expense_id: str, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.user_id == user.id))
    expense = result.scalar_one_or_none()
    if not expense: raise HTTPException(404, "Expense not found")
    await db.delete(expense)
    await db.commit()
    return {"message": "Expense deleted"}


# ─── Budget Router ────────────────────────────────────────────────────────────
budget_router = APIRouter()

class BudgetCreate(BaseModel):
    name: str
    category: str
    limit_amount: float
    period: str  # monthly, weekly, yearly
    start_date: date
    end_date: date
    alert_threshold: float = 80

@budget_router.post("/", status_code=201)
async def create_budget(data: BudgetCreate, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    budget = Budget(user_id=user.id, **data.dict())
    db.add(budget)
    await db.commit()
    return {"message": "Budget created"}

@budget_router.get("/")
async def get_budgets(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Budget).where(Budget.user_id == user.id, Budget.is_active == True))
    budgets = result.scalars().all()
    return {
        "budgets": [{
            "id": str(b.id),
            "name": b.name,
            "category": b.category,
            "limit_amount": float(b.limit_amount),
            "spent_amount": float(b.spent_amount),
            "percentage_used": round(float(b.spent_amount) / float(b.limit_amount) * 100, 1) if b.limit_amount > 0 else 0,
            "is_exceeded": float(b.spent_amount) > float(b.limit_amount),
            "period": b.period
        } for b in budgets]
    }


# ─── Savings Router ───────────────────────────────────────────────────────────
savings_router = APIRouter()

class SavingsCreate(BaseModel):
    title: str
    target_amount: float
    description: Optional[str] = None
    category: Optional[str] = "general"
    target_date: Optional[date] = None
    icon: Optional[str] = "🎯"
    color: Optional[str] = "#16a34a"

class ContributionCreate(BaseModel):
    amount: float
    note: Optional[str] = None
    date: date

@savings_router.post("/", status_code=201)
async def create_savings_goal(data: SavingsCreate, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    goal = SavingsGoal(user_id=user.id, **data.dict())
    db.add(goal)
    await db.commit()
    return {"message": "Savings goal created"}

@savings_router.post("/{goal_id}/contribute")
async def contribute_to_goal(goal_id: str, data: ContributionCreate, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id))
    goal = result.scalar_one_or_none()
    if not goal: raise HTTPException(404, "Goal not found")
    
    goal.current_amount = float(goal.current_amount) + data.amount
    if float(goal.current_amount) >= float(goal.target_amount):
        goal.status = "completed"
    
    contribution = SavingsContribution(goal_id=goal_id, user_id=user.id, **data.dict())
    db.add(contribution)
    await db.commit()
    return {"message": "Contribution added", "new_total": float(goal.current_amount)}

@savings_router.get("/")
async def get_savings_goals(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavingsGoal).where(SavingsGoal.user_id == user.id).order_by(desc(SavingsGoal.created_at)))
    goals = result.scalars().all()
    return {
        "goals": [{
            "id": str(g.id),
            "title": g.title,
            "target_amount": float(g.target_amount),
            "current_amount": float(g.current_amount),
            "progress": round(float(g.current_amount) / float(g.target_amount) * 100, 1) if g.target_amount > 0 else 0,
            "category": g.category,
            "status": g.status,
            "target_date": str(g.target_date) if g.target_date else None,
            "icon": g.icon,
            "color": g.color,
            "currency": user.currency
        } for g in goals]
    }


# ─── Investment Router ────────────────────────────────────────────────────────
investment_router = APIRouter()

class InvestmentCreate(BaseModel):
    name: str
    type: str
    symbol: Optional[str] = None
    quantity: Optional[float] = None
    buy_price: float
    current_price: Optional[float] = None
    buy_date: date
    maturity_date: Optional[date] = None
    interest_rate: Optional[float] = None
    broker: Optional[str] = None
    notes: Optional[str] = None

@investment_router.post("/", status_code=201)
async def create_investment(data: InvestmentCreate, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    investment = Investment(user_id=user.id, **data.dict())
    db.add(investment)
    await db.commit()
    return {"message": "Investment added"}

@investment_router.get("/")
async def get_investments(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Investment).where(Investment.user_id == user.id, Investment.status == "active"))
    investments = result.scalars().all()
    
    portfolio = []
    total_invested = 0
    total_value = 0
    
    for inv in investments:
        qty = float(inv.quantity or 1)
        buy = float(inv.buy_price)
        current = float(inv.current_price or inv.buy_price)
        invested = buy * qty
        value = current * qty
        pnl = value - invested
        roi = (pnl / invested * 100) if invested > 0 else 0
        
        total_invested += invested
        total_value += value
        
        portfolio.append({
            "id": str(inv.id),
            "name": inv.name,
            "type": inv.type,
            "symbol": inv.symbol,
            "quantity": qty,
            "buy_price": buy,
            "current_price": current,
            "total_invested": round(invested, 2),
            "current_value": round(value, 2),
            "pnl": round(pnl, 2),
            "roi_percent": round(roi, 2),
            "buy_date": str(inv.buy_date),
            "broker": inv.broker
        })
    
    return {
        "investments": portfolio,
        "portfolio_summary": {
            "total_invested": round(total_invested, 2),
            "total_value": round(total_value, 2),
            "total_pnl": round(total_value - total_invested, 2),
            "overall_roi": round((total_value - total_invested) / total_invested * 100, 2) if total_invested > 0 else 0
        },
        "currency": user.currency
    }


# ─── Analytics Router ─────────────────────────────────────────────────────────
analytics_router = APIRouter()

@analytics_router.get("/overview")
async def get_analytics_overview(
    period: str = "month",  # month, quarter, year
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    from datetime import timedelta
    days = {"month": 30, "quarter": 90, "year": 365}.get(period, 30)
    since = date.today() - timedelta(days=days)
    
    income_result = await db.execute(
        select(func.sum(Income.amount), func.count(Income.id))
        .where(Income.user_id == user.id, Income.date >= since)
    )
    income_total, income_count = income_result.one()
    
    expense_result = await db.execute(
        select(func.sum(Expense.amount), func.count(Expense.id))
        .where(Expense.user_id == user.id, Expense.date >= since)
    )
    expense_total, expense_count = expense_result.one()
    
    # Category breakdown
    cat_result = await db.execute(
        select(Expense.category, func.sum(Expense.amount))
        .where(Expense.user_id == user.id, Expense.date >= since)
        .group_by(Expense.category)
        .order_by(desc(func.sum(Expense.amount)))
    )
    categories = cat_result.all()
    
    income_f = float(income_total or 0)
    expense_f = float(expense_total or 0)
    
    return {
        "period": period,
        "income": {"total": income_f, "count": income_count or 0},
        "expenses": {"total": expense_f, "count": expense_count or 0},
        "net_savings": income_f - expense_f,
        "savings_rate": round((income_f - expense_f) / income_f * 100, 1) if income_f > 0 else 0,
        "categories": [{"category": c[0], "amount": float(c[1])} for c in categories],
        "currency": user.currency
    }


# ─── Financial Advisor Portal Router ─────────────────────────────────────────
advisor_router = APIRouter()

@advisor_router.get("/clients")
async def get_advisor_clients(advisor: User = Depends(require_advisor), db: AsyncSession = Depends(get_db)):
    """Get all users assigned to this financial advisor"""
    result = await db.execute(select(User).where(User.advisor_id == advisor.id, User.is_active == True))
    clients = result.scalars().all()
    
    client_list = []
    for client in clients:
        # Get latest health score
        hs_result = await db.execute(
            select(HealthScore).where(HealthScore.user_id == client.id).order_by(desc(HealthScore.calculated_at)).limit(1)
        )
        latest_hs = hs_result.scalar_one_or_none()
        
        client_list.append({
            "id": str(client.id),
            "name": f"{client.first_name} {client.last_name or ''}",
            "email": client.email,
            "currency": client.currency,
            "health_score": latest_hs.score if latest_hs else None,
            "health_grade": latest_hs.grade if latest_hs else None,
            "last_login": client.last_login_at.isoformat() if client.last_login_at else None,
            "created_at": client.created_at.isoformat()
        })
    
    return {"clients": client_list, "total": len(client_list)}

@advisor_router.get("/clients/{client_id}/overview")
async def get_client_overview(
    client_id: str,
    advisor: User = Depends(require_advisor),
    db: AsyncSession = Depends(get_db)
):
    """View a client's financial overview"""
    result = await db.execute(select(User).where(User.id == client_id, User.advisor_id == advisor.id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client not found or not assigned to you")
    
    from datetime import timedelta
    since = date.today() - timedelta(days=30)
    
    income_result = await db.execute(select(func.sum(Income.amount)).where(Income.user_id == client.id, Income.date >= since))
    expense_result = await db.execute(select(func.sum(Expense.amount)).where(Expense.user_id == client.id, Expense.date >= since))
    
    income = float(income_result.scalar() or 0)
    expenses = float(expense_result.scalar() or 0)
    
    hs_result = await db.execute(
        select(HealthScore).where(HealthScore.user_id == client.id).order_by(desc(HealthScore.calculated_at)).limit(1)
    )
    latest_hs = hs_result.scalar_one_or_none()
    
    return {
        "client": {
            "id": str(client.id),
            "name": f"{client.first_name} {client.last_name or ''}",
            "email": client.email,
            "currency": client.currency
        },
        "monthly_summary": {
            "income": income,
            "expenses": expenses,
            "net": income - expenses,
            "savings_rate": round((income - expenses) / income * 100, 1) if income > 0 else 0
        },
        "health_score": {
            "score": latest_hs.score if latest_hs else None,
            "grade": latest_hs.grade if latest_hs else None,
            "breakdown": latest_hs.breakdown if latest_hs else None
        }
    }


# ─── Family Accounts Router ───────────────────────────────────────────────────
family_router = APIRouter()

class FamilyGroupCreate(BaseModel):
    name: str

@family_router.post("/create")
async def create_family_group(data: FamilyGroupCreate, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    from models.models import FamilyGroup
    group = FamilyGroup(name=data.name, owner_id=user.id, currency=user.currency)
    db.add(group)
    await db.flush()
    user.family_group_id = group.id
    await db.commit()
    return {"group_id": str(group.id), "message": "Family group created"}

@family_router.get("/members")
async def get_family_members(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    if not user.family_group_id:
        return {"members": [], "message": "Not part of a family group"}
    
    result = await db.execute(select(User).where(User.family_group_id == user.family_group_id))
    members = result.scalars().all()
    
    return {
        "family_group_id": str(user.family_group_id),
        "members": [
            {"id": str(m.id), "name": f"{m.first_name} {m.last_name or ''}", "email": m.email}
            for m in members
        ]
    }
