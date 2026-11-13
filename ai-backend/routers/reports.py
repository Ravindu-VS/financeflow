"""
Report Generation Router — PDF, Excel, CSV Reports
WSO2 Integrator BI automated report workflow
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime
import os
import uuid

from models.models import User, Income, Expense, Budget, SavingsGoal, Investment, Report
from database.connection import get_db
from core.auth import get_current_active_user
from services.report_generator import generate_pdf_report, generate_excel_report
from config import settings

router = APIRouter()
REPORTS_DIR = settings.REPORTS_DIR  # /tmp/reports on serverless (read-only filesystem elsewhere)


MEDIA_TYPES = {"pdf": "application/pdf", "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "csv": "text/csv"}


class ReportRequest(BaseModel):
    type: Literal['monthly', 'weekly', 'yearly', 'custom', 'daily', 'quarterly']
    format: Literal['pdf', 'excel', 'xlsx', 'csv']
    period_start: date
    period_end: date
    # Return the file in this response (serverless instances don't share a disk between requests)
    inline: bool = False


async def _collect_report_data(user: User, period_start: date, period_end: date, db: AsyncSession) -> dict:
    """Collect all data for report generation"""
    # Income
    income_result = await db.execute(
        select(Income).where(
            Income.user_id == user.id,
            Income.date >= period_start,
            Income.date <= period_end
        ).order_by(Income.date)
    )
    incomes = income_result.scalars().all()

    # Expenses
    expense_result = await db.execute(
        select(Expense).where(
            Expense.user_id == user.id,
            Expense.date >= period_start,
            Expense.date <= period_end
        ).order_by(Expense.date)
    )
    expenses = expense_result.scalars().all()

    # Budgets
    budget_result = await db.execute(
        select(Budget).where(Budget.user_id == user.id, Budget.is_active == True)
    )
    budgets = budget_result.scalars().all()

    # Savings
    savings_result = await db.execute(
        select(SavingsGoal).where(SavingsGoal.user_id == user.id, SavingsGoal.status == "active")
    )
    savings = savings_result.scalars().all()

    # Investments
    inv_result = await db.execute(
        select(Investment).where(Investment.user_id == user.id, Investment.status == "active")
    )
    investments = inv_result.scalars().all()

    # Category breakdown
    by_category: dict = {}
    for e in expenses:
        by_category[e.category] = by_category.get(e.category, 0) + float(e.amount)

    return {
        "user": {
            "name": f"{user.first_name} {user.last_name or ''}",
            "email": user.email,
            "currency": user.currency
        },
        "period": {
            "start": str(period_start),
            "end": str(period_end)
        },
        "summary": {
            "total_income": sum(float(i.amount) for i in incomes),
            "total_expenses": sum(float(e.amount) for e in expenses),
            "net_savings": sum(float(i.amount) for i in incomes) - sum(float(e.amount) for e in expenses),
            "savings_rate": 0
        },
        "income": [{"title": i.title, "amount": float(i.amount), "source": i.source, "date": str(i.date)} for i in incomes],
        "expenses": [{"title": e.title, "amount": float(e.amount), "category": e.category, "date": str(e.date)} for e in expenses],
        "expense_by_category": by_category,
        "budgets": [{"name": b.name, "limit": float(b.limit_amount), "spent": float(b.spent_amount)} for b in budgets],
        "savings_goals": [{"title": s.title, "target": float(s.target_amount), "current": float(s.current_amount)} for s in savings],
        "investments": [{"name": i.name, "type": i.type, "amount": float(i.buy_price * (i.quantity or 1))} for i in investments],
        "generated_at": datetime.now().isoformat()
    }


@router.post("/generate")
async def generate_report(
    request: ReportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate financial report (PDF/Excel/CSV)"""
    if request.period_end < request.period_start:
        raise HTTPException(status_code=422, detail="period_end is before period_start")
    os.makedirs(REPORTS_DIR, exist_ok=True)
    report_id = str(uuid.uuid4())
    filename = f"finai_report_{current_user.id}_{report_id[:8]}.{request.format}"
    filepath = os.path.join(REPORTS_DIR, filename)

    # Create report record
    report = Report(
        id=report_id,
        user_id=current_user.id,
        title=f"{request.type.title()} Financial Report {request.period_start} to {request.period_end}",
        type=request.type,
        format=request.format,
        period_start=request.period_start,
        period_end=request.period_end,
        file_url=filepath,
        status="generating"
    )
    db.add(report)
    await db.commit()

    # Collect data
    data = await _collect_report_data(current_user, request.period_start, request.period_end, db)
    
    # Calculate savings rate
    if data["summary"]["total_income"] > 0:
        data["summary"]["savings_rate"] = round(
            data["summary"]["net_savings"] / data["summary"]["total_income"] * 100, 1
        )

    # Generate file
    try:
        if request.format == "pdf":
            await generate_pdf_report(data, filepath)
        elif request.format in ["excel", "xlsx"]:
            await generate_excel_report(data, filepath)
        elif request.format == "csv":
            await _generate_csv(data, filepath)

        # Update report status
        report.status = "ready"
        report.file_size_bytes = os.path.getsize(filepath) if os.path.exists(filepath) else 0
        await db.commit()

        if request.inline:
            return FileResponse(path=filepath, media_type=MEDIA_TYPES.get(request.format, "application/octet-stream"), filename=filename)
        return {
            "report_id": report_id,
            "status": "ready",
            "download_url": f"/api/v1/reports/download/{report_id}",
            "filename": filename
        }
    except Exception as e:
        report.status = "failed"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/download/{report_id}")
async def download_report(
    report_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Download generated report file"""
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.user_id == current_user.id)
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != "ready":
        raise HTTPException(status_code=400, detail=f"Report status: {report.status}")

    if not os.path.exists(report.file_url):
        raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(
        path=report.file_url,
        media_type=MEDIA_TYPES.get(report.format, "application/octet-stream"),
        filename=os.path.basename(report.file_url)
    )


@router.get("/list")
async def list_reports(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List user's generated reports"""
    result = await db.execute(
        select(Report)
        .where(Report.user_id == current_user.id)
        .order_by(desc(Report.created_at))
        .limit(20)
    )
    reports = result.scalars().all()

    return {
        "reports": [
            {
                "id": str(r.id),
                "title": r.title,
                "type": r.type,
                "format": r.format,
                "period_start": str(r.period_start),
                "period_end": str(r.period_end),
                "status": r.status,
                "download_url": f"/api/v1/reports/download/{r.id}" if r.status == "ready" else None,
                "created_at": r.created_at.isoformat()
            }
            for r in reports
        ]
    }


async def _generate_csv(data: dict, filepath: str):
    """Generate CSV report"""
    import csv
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["FinAI Enterprise — Financial Report"])
        writer.writerow(["Generated:", data["generated_at"]])
        writer.writerow(["Period:", data["period"]["start"], "to", data["period"]["end"]])
        writer.writerow([])
        writer.writerow(["SUMMARY"])
        writer.writerow(["Total Income", data["summary"]["total_income"]])
        writer.writerow(["Total Expenses", data["summary"]["total_expenses"]])
        writer.writerow(["Net Savings", data["summary"]["net_savings"]])
        writer.writerow(["Savings Rate %", data["summary"]["savings_rate"]])
        writer.writerow([])
        writer.writerow(["EXPENSES"])
        writer.writerow(["Title", "Amount", "Category", "Date"])
        for e in data["expenses"]:
            writer.writerow([e["title"], e["amount"], e["category"], e["date"]])
        writer.writerow([])
        writer.writerow(["INCOME"])
        writer.writerow(["Title", "Amount", "Source", "Date"])
        for i in data["income"]:
            writer.writerow([i["title"], i["amount"], i["source"], i["date"]])
