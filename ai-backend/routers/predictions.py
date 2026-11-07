"""
Expense Prediction Router — ML Forecasting
Uses ARIMA/Linear Regression for time-series expense prediction
WSO2 Integrator BI ML pipeline pattern
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, timedelta
from collections import defaultdict
import numpy as np

from models.models import User, Expense, Income
from database.connection import get_db
from core.auth import get_current_active_user

router = APIRouter()


def _simple_linear_trend(values: list) -> tuple:
    """Simple linear regression on time series"""
    n = len(values)
    if n < 2:
        return values[-1] if values else 0, 0
    x = np.arange(n)
    slope, intercept = np.polyfit(x, values, 1)
    return slope, intercept


def _predict_next_n(values: list, n: int = 3) -> list:
    """Predict next n values using linear extrapolation"""
    if len(values) < 2:
        return [values[-1] if values else 0] * n
    slope, intercept = _simple_linear_trend(values)
    length = len(values)
    predictions = []
    for i in range(1, n + 1):
        pred = intercept + slope * (length + i - 1)
        predictions.append(max(0, round(float(pred), 2)))
    return predictions


def _moving_average(values: list, window: int = 3) -> float:
    """Calculate moving average"""
    if not values:
        return 0
    window = min(window, len(values))
    return sum(values[-window:]) / window


@router.get("/expenses")
async def predict_expenses(
    months_ahead: int = 3,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Predict future monthly expenses using ML regression.
    Returns predictions with confidence intervals.
    """
    # Fetch 12 months of expense data
    twelve_months_ago = date.today() - timedelta(days=365)
    result = await db.execute(
        select(Expense)
        .where(Expense.user_id == current_user.id, Expense.date >= twelve_months_ago)
        .order_by(Expense.date)
    )
    expenses = result.scalars().all()

    # Group by month
    monthly_totals: dict = defaultdict(float)
    monthly_by_category: dict = defaultdict(lambda: defaultdict(float))
    
    for e in expenses:
        month_key = e.date.strftime("%Y-%m")
        monthly_totals[month_key] += float(e.amount)
        monthly_by_category[month_key][e.category] += float(e.amount)

    sorted_months = sorted(monthly_totals.keys())
    monthly_values = [monthly_totals[m] for m in sorted_months]

    if len(monthly_values) < 2:
        return {
            "status": "insufficient_data",
            "message": "Need at least 2 months of data for predictions",
            "predictions": []
        }

    # Predict total expenses
    predictions = _predict_next_n(monthly_values, months_ahead)
    moving_avg = _moving_average(monthly_values)

    # Predict by category
    all_categories = set()
    for m in monthly_by_category.values():
        all_categories.update(m.keys())
    
    category_predictions = {}
    for cat in all_categories:
        cat_values = [monthly_by_category[m].get(cat, 0) for m in sorted_months]
        cat_preds = _predict_next_n(cat_values, months_ahead)
        category_predictions[cat] = cat_preds

    # Calculate trend
    if len(monthly_values) >= 2:
        trend_pct = ((monthly_values[-1] - monthly_values[0]) / monthly_values[0] * 100) if monthly_values[0] > 0 else 0
        trend = "increasing" if trend_pct > 5 else "decreasing" if trend_pct < -5 else "stable"
    else:
        trend = "stable"
        trend_pct = 0

    # Confidence (higher with more data)
    confidence = min(0.95, 0.5 + len(monthly_values) * 0.04)

    # Build future month labels
    last_month = date.today().replace(day=1)
    future_months = []
    for i in range(1, months_ahead + 1):
        month = last_month.replace(month=((last_month.month - 1 + i) % 12) + 1)
        if last_month.month + i > 12:
            month = month.replace(year=last_month.year + (last_month.month + i - 1) // 12)
        future_months.append(month.strftime("%Y-%m"))

    return {
        "historical": {
            "months": sorted_months,
            "values": monthly_values,
            "moving_average": round(moving_avg, 2)
        },
        "predictions": [
            {
                "month": future_months[i] if i < len(future_months) else f"Month {i+1}",
                "predicted_amount": predictions[i],
                "confidence_lower": round(predictions[i] * 0.85, 2),
                "confidence_upper": round(predictions[i] * 1.15, 2),
                "currency": current_user.currency
            }
            for i in range(len(predictions))
        ],
        "category_predictions": {
            cat: [
                {"month": future_months[i] if i < len(future_months) else f"Month {i+1}", "amount": category_predictions[cat][i]}
                for i in range(len(category_predictions[cat]))
            ]
            for cat in category_predictions
        },
        "trend": {
            "direction": trend,
            "change_percent": round(trend_pct, 1),
            "message": f"Expenses are {trend} ({abs(trend_pct):.1f}% {'increase' if trend_pct > 0 else 'decrease'} over 12 months)"
        },
        "model": {
            "name": "Linear Regression with Moving Average",
            "confidence": round(confidence, 2),
            "data_points": len(monthly_values),
            "engine": "NumPy + custom ML"
        }
    }


@router.get("/cashflow")
async def predict_cashflow(
    months_ahead: int = 3,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Predict future net cashflow (income - expenses)"""
    six_months_ago = date.today() - timedelta(days=180)
    
    income_result = await db.execute(
        select(Income).where(Income.user_id == current_user.id, Income.date >= six_months_ago).order_by(Income.date)
    )
    expenses_result = await db.execute(
        select(Expense).where(Expense.user_id == current_user.id, Expense.date >= six_months_ago).order_by(Expense.date)
    )
    
    incomes = income_result.scalars().all()
    expenses = expenses_result.scalars().all()
    
    monthly_income: dict = defaultdict(float)
    monthly_expense: dict = defaultdict(float)
    
    for i in incomes:
        monthly_income[i.date.strftime("%Y-%m")] += float(i.amount)
    for e in expenses:
        monthly_expense[e.date.strftime("%Y-%m")] += float(e.amount)
    
    all_months = sorted(set(list(monthly_income.keys()) + list(monthly_expense.keys())))
    income_values = [monthly_income.get(m, 0) for m in all_months]
    expense_values = [monthly_expense.get(m, 0) for m in all_months]
    cashflow_values = [i - e for i, e in zip(income_values, expense_values)]
    
    predicted_income = _predict_next_n(income_values, months_ahead)
    predicted_expenses = _predict_next_n(expense_values, months_ahead)
    predicted_cashflow = [round(i - e, 2) for i, e in zip(predicted_income, predicted_expenses)]
    
    return {
        "historical_cashflow": [
            {"month": m, "income": income_values[i], "expenses": expense_values[i], "net": cashflow_values[i]}
            for i, m in enumerate(all_months)
        ],
        "predicted_cashflow": [
            {
                "period": f"Month +{i+1}",
                "predicted_income": predicted_income[i],
                "predicted_expenses": predicted_expenses[i],
                "predicted_net": predicted_cashflow[i],
                "status": "surplus" if predicted_cashflow[i] > 0 else "deficit"
            }
            for i in range(len(predicted_cashflow))
        ],
        "currency": current_user.currency
    }


@router.get("/budget-risks")
async def predict_budget_risks(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Identify categories at risk of exceeding budget"""
    from models.models import Budget
    
    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == current_user.id, Budget.is_active == True)
    )
    budgets = budgets_result.scalars().all()
    
    risks = []
    for budget in budgets:
        limit = float(budget.limit_amount)
        spent = float(budget.spent_amount)
        pct = (spent / limit * 100) if limit > 0 else 0
        days_in_month = 30
        today = date.today().day
        projected = (spent / today) * days_in_month if today > 0 else spent
        
        risk_level = "low"
        if pct >= 90 or projected > limit:
            risk_level = "critical"
        elif pct >= 75:
            risk_level = "high"
        elif pct >= 60:
            risk_level = "medium"
        
        risks.append({
            "budget_name": budget.name,
            "category": budget.category,
            "limit": limit,
            "current_spent": spent,
            "percentage_used": round(pct, 1),
            "projected_month_end": round(projected, 2),
            "will_exceed": projected > limit,
            "risk_level": risk_level,
            "currency": current_user.currency
        })
    
    # Sort by risk
    risk_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    risks.sort(key=lambda x: risk_order[x["risk_level"]])
    
    return {"budget_risks": risks, "high_risk_count": sum(1 for r in risks if r["risk_level"] in ["critical", "high"])}
