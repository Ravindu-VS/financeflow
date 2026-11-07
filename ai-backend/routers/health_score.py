"""
Financial Health Score Engine
Calculates 0-100 score across 6 financial dimensions
WSO2 Integrator BI automated workflow pattern
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import date, timedelta
from models.models import User, Income, Expense, Budget, SavingsGoal, Investment, HealthScore
from database.connection import get_db
from core.auth import get_current_active_user
import math

router = APIRouter()


def _calculate_grade(score: int) -> str:
    if score >= 90: return "A+"
    if score >= 80: return "A"
    if score >= 70: return "B"
    if score >= 60: return "C"
    if score >= 50: return "D"
    return "F"


def _calculate_saving_rate_score(income: float, expenses: float) -> dict:
    """Score based on savings rate (target: 20%+)"""
    if income <= 0:
        return {"score": 0, "rate": 0, "message": "No income recorded"}
    rate = (income - expenses) / income * 100
    if rate >= 30:   score = 100
    elif rate >= 25: score = 90
    elif rate >= 20: score = 80
    elif rate >= 15: score = 65
    elif rate >= 10: score = 50
    elif rate >= 5:  score = 35
    elif rate >= 0:  score = 20
    else:            score = 0
    return {
        "score": score,
        "rate": round(rate, 1),
        "message": f"Saving {rate:.1f}% of income. Target: 20%+"
    }


def _calculate_expense_ratio_score(expenses: float, income: float) -> dict:
    """Score based on expense-to-income ratio (lower is better)"""
    if income <= 0:
        return {"score": 50, "ratio": 0, "message": "No income data"}
    ratio = expenses / income * 100
    if ratio <= 50:   score = 100
    elif ratio <= 60: score = 90
    elif ratio <= 70: score = 75
    elif ratio <= 80: score = 60
    elif ratio <= 90: score = 40
    elif ratio <= 100: score = 20
    else:              score = 0
    return {
        "score": score,
        "ratio": round(ratio, 1),
        "message": f"Spending {ratio:.1f}% of income. Target: <70%"
    }


def _calculate_budget_discipline_score(budgets: list) -> dict:
    """Score based on staying within budgets"""
    if not budgets:
        return {"score": 50, "message": "No budgets set — create budgets for better tracking"}
    
    total_score = 0
    over_budget = 0
    for b in budgets:
        if float(b.limit_amount) > 0:
            pct = float(b.spent_amount) / float(b.limit_amount) * 100
            if pct <= 70:   total_score += 100
            elif pct <= 80: total_score += 85
            elif pct <= 90: total_score += 70
            elif pct <= 100: total_score += 50
            else:
                total_score += max(0, 50 - (pct - 100))
                over_budget += 1
    
    score = int(total_score / len(budgets)) if budgets else 50
    return {
        "score": score,
        "budgets_over": over_budget,
        "total_budgets": len(budgets),
        "message": f"{over_budget} of {len(budgets)} budgets exceeded"
    }


def _calculate_investment_score(investments: list, monthly_income: float) -> dict:
    """Score based on investment activity"""
    if not investments:
        return {"score": 20, "message": "No investments — consider starting with FDs or mutual funds"}
    
    total_invested = sum(float(i.buy_price) * float(i.quantity or 1) for i in investments)
    types = set(i.type for i in investments)
    
    # Diversification bonus
    diversification = min(len(types) * 15, 40)
    
    # Investment ratio to income bonus
    if monthly_income and monthly_income > 0:
        ratio = (total_invested / 12) / float(monthly_income) * 100
        if ratio >= 20: ratio_score = 60
        elif ratio >= 10: ratio_score = 40
        else: ratio_score = 20
    else:
        ratio_score = 20
    
    score = min(100, diversification + ratio_score)
    return {
        "score": score,
        "total_invested": round(total_invested, 2),
        "types": list(types),
        "message": f"Invested across {len(types)} asset type(s)"
    }


def _calculate_emergency_fund_score(savings_goals: list, monthly_expenses: float) -> dict:
    """Score based on emergency fund (target: 6 months expenses)"""
    emergency_goals = [g for g in savings_goals if g.category == "emergency"]
    
    if not emergency_goals:
        return {"score": 20, "months": 0, "message": "No emergency fund! Create one as priority"}
    
    total_emergency = sum(float(g.current_amount) for g in emergency_goals)
    target_months = 6
    monthly_buffer = monthly_expenses if monthly_expenses > 0 else 1
    months_covered = total_emergency / monthly_buffer
    
    if months_covered >= 6:   score = 100
    elif months_covered >= 4: score = 80
    elif months_covered >= 3: score = 60
    elif months_covered >= 1: score = 40
    else:                      score = 20
    
    return {
        "score": score,
        "months_covered": round(months_covered, 1),
        "target_months": target_months,
        "message": f"{months_covered:.1f} months covered. Target: 6 months"
    }


@router.get("/calculate")
async def calculate_health_score(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate comprehensive financial health score (0-100)
    Runs as WSO2 Integrator BI automated workflow
    """
    thirty_days_ago = date.today() - timedelta(days=30)
    ninety_days_ago = date.today() - timedelta(days=90)

    # Fetch data
    income_result = await db.execute(
        select(func.sum(Income.amount)).where(Income.user_id == current_user.id, Income.date >= ninety_days_ago)
    )
    total_income_3m = float(income_result.scalar() or 0)

    expense_result = await db.execute(
        select(func.sum(Expense.amount)).where(Expense.user_id == current_user.id, Expense.date >= ninety_days_ago)
    )
    total_expenses_3m = float(expense_result.scalar() or 0)

    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == current_user.id, Budget.is_active == True)
    )
    budgets = budgets_result.scalars().all()

    savings_result = await db.execute(
        select(SavingsGoal).where(SavingsGoal.user_id == current_user.id, SavingsGoal.status == "active")
    )
    savings_goals = savings_result.scalars().all()

    investments_result = await db.execute(
        select(Investment).where(Investment.user_id == current_user.id, Investment.status == "active")
    )
    investments = investments_result.scalars().all()

    # Monthly averages
    monthly_income = total_income_3m / 3
    monthly_expenses = total_expenses_3m / 3
    monthly_income_setting = float(current_user.monthly_income or monthly_income)

    # Calculate individual scores
    saving_data = _calculate_saving_rate_score(total_income_3m, total_expenses_3m)
    expense_data = _calculate_expense_ratio_score(total_expenses_3m, total_income_3m)
    budget_data = _calculate_budget_discipline_score(budgets)
    investment_data = _calculate_investment_score(investments, monthly_income_setting)
    emergency_data = _calculate_emergency_fund_score(savings_goals, monthly_expenses)

    # Weighted total score
    weights = {
        "saving_rate": 0.25,
        "expense_ratio": 0.20,
        "budget_discipline": 0.20,
        "investment": 0.20,
        "emergency_fund": 0.15
    }

    total_score = int(
        saving_data["score"] * weights["saving_rate"] +
        expense_data["score"] * weights["expense_ratio"] +
        budget_data["score"] * weights["budget_discipline"] +
        investment_data["score"] * weights["investment"] +
        emergency_data["score"] * weights["emergency_fund"]
    )

    grade = _calculate_grade(total_score)

    # Build recommendations
    recommendations = []
    if saving_data["score"] < 70:
        recommendations.append({"priority": "high", "action": "Increase savings rate to at least 20% of income"})
    if expense_data["score"] < 70:
        recommendations.append({"priority": "high", "action": "Reduce expenses below 70% of income"})
    if emergency_data["score"] < 60:
        recommendations.append({"priority": "urgent", "action": "Build emergency fund to cover 6 months of expenses"})
    if investment_data["score"] < 50:
        recommendations.append({"priority": "medium", "action": "Start investing — consider Fixed Deposits or index funds"})
    if budget_data["score"] < 70:
        recommendations.append({"priority": "medium", "action": f"{budget_data['budgets_over']} budget(s) exceeded — review spending"})

    breakdown = {
        "saving_rate": saving_data,
        "expense_ratio": expense_data,
        "budget_discipline": budget_data,
        "investment": investment_data,
        "emergency_fund": emergency_data
    }

    # Save to DB
    health_score_record = HealthScore(
        user_id=current_user.id,
        score=total_score,
        grade=grade,
        saving_rate_score=saving_data["score"],
        expense_ratio_score=expense_data["score"],
        budget_discipline_score=budget_data["score"],
        investment_score=investment_data["score"],
        emergency_fund_score=emergency_data["score"],
        debt_score=70,  # Default - debt tracking to be added
        breakdown=breakdown,
        recommendations=recommendations
    )
    db.add(health_score_record)
    await db.commit()

    return {
        "score": total_score,
        "grade": grade,
        "breakdown": breakdown,
        "recommendations": recommendations,
        "weights": weights,
        "summary": {
            "monthly_income": round(monthly_income, 2),
            "monthly_expenses": round(monthly_expenses, 2),
            "monthly_savings": round(monthly_income - monthly_expenses, 2),
            "currency": current_user.currency
        }
    }


@router.get("/history")
async def get_score_history(
    limit: int = 12,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get historical health score trend"""
    result = await db.execute(
        select(HealthScore)
        .where(HealthScore.user_id == current_user.id)
        .order_by(desc(HealthScore.calculated_at))
        .limit(limit)
    )
    scores = result.scalars().all()

    return {
        "history": [
            {
                "score": s.score,
                "grade": s.grade,
                "calculated_at": s.calculated_at.isoformat()
            }
            for s in reversed(scores)
        ]
    }
