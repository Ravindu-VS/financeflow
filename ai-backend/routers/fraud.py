"""
Fraud Detection Router — Z-Score Anomaly Detection
Detects unusual transactions and spending patterns
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import date, timedelta
import numpy as np
from collections import defaultdict

from models.models import User, Expense
from database.connection import get_db
from core.auth import get_current_active_user

router = APIRouter()

FRAUD_THRESHOLD_ZSCORE = 2.5  # Flag transactions > 2.5 standard deviations
DUPLICATE_WINDOW_HOURS = 24


def _calculate_z_score(value: float, mean: float, std: float) -> float:
    if std == 0:
        return 0
    return abs((value - mean) / std)


@router.get("/scan")
async def scan_for_anomalies(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Run fraud/anomaly detection on user's transactions.
    Uses Z-score statistical analysis per category.
    """
    ninety_days_ago = date.today() - timedelta(days=90)
    
    result = await db.execute(
        select(Expense)
        .where(Expense.user_id == current_user.id, Expense.date >= ninety_days_ago)
        .order_by(desc(Expense.date))
    )
    expenses = result.scalars().all()
    
    if len(expenses) < 5:
        return {
            "status": "insufficient_data",
            "message": "Need at least 5 transactions for anomaly detection",
            "anomalies": []
        }
    
    # Group by category for per-category analysis
    by_category: dict = defaultdict(list)
    for e in expenses:
        by_category[e.category].append(e)
    
    anomalies = []
    flagged_ids = set()
    
    for category, cat_expenses in by_category.items():
        if len(cat_expenses) < 3:
            continue
        
        amounts = [float(e.amount) for e in cat_expenses]
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        
        for expense in cat_expenses:
            amount = float(expense.amount)
            z_score = _calculate_z_score(amount, mean_amount, std_amount)
            
            if z_score >= FRAUD_THRESHOLD_ZSCORE:
                fraud_score = min(1.0, z_score / 5.0)
                anomalies.append({
                    "expense_id": str(expense.id),
                    "title": expense.title,
                    "amount": amount,
                    "category": category,
                    "date": str(expense.date),
                    "z_score": round(z_score, 2),
                    "fraud_score": round(fraud_score, 4),
                    "category_average": round(mean_amount, 2),
                    "deviation": round(amount - mean_amount, 2),
                    "anomaly_type": "high_amount",
                    "risk_level": "critical" if z_score >= 4 else "high" if z_score >= 3 else "medium",
                    "reason": f"Amount is {z_score:.1f}x standard deviations above {category} average",
                    "currency": current_user.currency
                })
                flagged_ids.add(str(expense.id))
    
    # Duplicate detection (same amount within 24 hours)
    all_expenses_sorted = sorted(expenses, key=lambda e: (e.date, float(e.amount)))
    for i in range(len(all_expenses_sorted) - 1):
        e1 = all_expenses_sorted[i]
        e2 = all_expenses_sorted[i + 1]
        if (
            float(e1.amount) == float(e2.amount) and
            e1.category == e2.category and
            abs((e2.date - e1.date).days) <= 1 and
            str(e1.id) not in flagged_ids and
            str(e2.id) not in flagged_ids
        ):
            anomalies.append({
                "expense_id": str(e2.id),
                "title": e2.title,
                "amount": float(e2.amount),
                "category": e2.category,
                "date": str(e2.date),
                "z_score": 0,
                "fraud_score": 0.70,
                "anomaly_type": "potential_duplicate",
                "risk_level": "medium",
                "reason": f"Possible duplicate of transaction from {e1.date}",
                "duplicate_of": str(e1.id),
                "currency": current_user.currency
            })
    
    # Sort by fraud score
    anomalies.sort(key=lambda x: x["fraud_score"], reverse=True)
    
    return {
        "total_analyzed": len(expenses),
        "anomalies_found": len(anomalies),
        "risk_summary": {
            "critical": sum(1 for a in anomalies if a.get("risk_level") == "critical"),
            "high": sum(1 for a in anomalies if a.get("risk_level") == "high"),
            "medium": sum(1 for a in anomalies if a.get("risk_level") == "medium")
        },
        "anomalies": anomalies,
        "model": {
            "name": "Z-Score Anomaly Detection",
            "threshold": FRAUD_THRESHOLD_ZSCORE,
            "engine": "NumPy Statistical Analysis"
        }
    }


@router.get("/summary")
async def fraud_summary(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get count of flagged transactions"""
    result = await db.execute(
        select(func.count(Expense.id))
        .where(Expense.user_id == current_user.id, Expense.is_flagged == True)
    )
    flagged_count = result.scalar() or 0
    
    return {
        "flagged_transactions": flagged_count,
        "status": "alert" if flagged_count > 0 else "clear",
        "message": f"{flagged_count} transactions flagged for review" if flagged_count > 0 else "No suspicious activity detected"
    }
