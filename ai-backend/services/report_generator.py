"""
PDF and Excel Report Generator using ReportLab and openpyxl
"""
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference, PieChart
import asyncio
from datetime import datetime


async def generate_pdf_report(data: dict, filepath: str):
    """Generate a professional PDF financial report"""
    await asyncio.to_thread(_create_pdf, data, filepath)


def _create_pdf(data: dict, filepath: str):
    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=colors.HexColor('#1a1a2e'),
        spaceAfter=6,
        alignment=TA_CENTER
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#6b7280'),
        alignment=TA_CENTER,
        spaceAfter=20
    )
    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#16a34a'),
        spaceBefore=16,
        spaceAfter=8,
        borderPad=4
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#374151'),
        spaceAfter=4
    )

    elements = []
    currency = data["user"]["currency"]

    # ── Header ────────────────────────────────────────────────────────────────
    elements.append(Paragraph("FinAI Enterprise", title_style))
    elements.append(Paragraph("AI-Powered Financial Management Platform", subtitle_style))
    elements.append(Paragraph(f"Financial Report | {data['period']['start']} to {data['period']['end']}", subtitle_style))
    elements.append(Paragraph(f"Prepared for: {data['user']['name']} | {data['user']['email']}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#16a34a')))
    elements.append(Spacer(1, 12))

    # ── Summary Cards ─────────────────────────────────────────────────────────
    elements.append(Paragraph("Financial Summary", heading_style))
    
    summary = data["summary"]
    summary_data = [
        ["Metric", "Amount", "Status"],
        ["💰 Total Income", f"{currency} {summary['total_income']:,.2f}", "✓"],
        ["💸 Total Expenses", f"{currency} {summary['total_expenses']:,.2f}", "✓"],
        ["📈 Net Savings", f"{currency} {summary['net_savings']:,.2f}", "✓" if summary['net_savings'] >= 0 else "⚠"],
        ["📊 Savings Rate", f"{summary['savings_rate']}%", "✓" if summary['savings_rate'] >= 20 else "⚠"],
    ]
    
    summary_table = Table(summary_data, colWidths=[3.5*inch, 2.5*inch, 1*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#16a34a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f9fafb'), colors.white]),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (1, 0), (2, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 16))

    # ── Expense Breakdown ────────────────────────────────────────────────────
    if data.get("expense_by_category"):
        elements.append(Paragraph("Expense Breakdown by Category", heading_style))
        cat_data = [["Category", "Amount", "% of Total"]]
        total_exp = summary['total_expenses']
        sorted_cats = sorted(data["expense_by_category"].items(), key=lambda x: x[1], reverse=True)
        for cat, amount in sorted_cats:
            pct = (amount / total_exp * 100) if total_exp > 0 else 0
            cat_data.append([cat.title(), f"{currency} {amount:,.2f}", f"{pct:.1f}%"])
        
        cat_table = Table(cat_data, colWidths=[3*inch, 2.5*inch, 2*inch])
        cat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#fef3c7'), colors.white]),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#e5e7eb')),
            ('PADDING', (0, 0), (-1, -1), 7),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ]))
        elements.append(cat_table)
        elements.append(Spacer(1, 16))

    # ── Recent Transactions ───────────────────────────────────────────────────
    if data.get("expenses"):
        elements.append(Paragraph("Recent Expenses (Top 20)", heading_style))
        tx_data = [["Date", "Title", "Category", "Amount"]]
        for e in data["expenses"][:20]:
            tx_data.append([e["date"], e["title"][:35], e["category"].title(), f"{currency} {e['amount']:,.2f}"])
        
        tx_table = Table(tx_data, colWidths=[1.2*inch, 3.2*inch, 1.5*inch, 1.6*inch])
        tx_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f3ff')]),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#e5e7eb')),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
        ]))
        elements.append(tx_table)
        elements.append(Spacer(1, 16))

    # ── Investments ───────────────────────────────────────────────────────────
    if data.get("investments"):
        elements.append(Paragraph("Investment Portfolio", heading_style))
        inv_data = [["Name", "Type", "Amount"]]
        for i in data["investments"]:
            inv_data.append([i["name"][:30], i["type"].replace("_", " ").title(), f"{currency} {i['amount']:,.2f}"])
        
        inv_table = Table(inv_data, colWidths=[3.5*inch, 2*inch, 2*inch])
        inv_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#fffbeb'), colors.white]),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#e5e7eb')),
            ('PADDING', (0, 0), (-1, -1), 7),
        ]))
        elements.append(inv_table)

    # ── Footer ────────────────────────────────────────────────────────────────
    elements.append(Spacer(1, 24))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e5e7eb')))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        f"Generated by FinAI Enterprise | Powered by WSO2 Enterprise Architecture + Google Gemini AI | {data['generated_at'][:19]}",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7, textColor=colors.HexColor('#9ca3af'), alignment=TA_CENTER)
    ))
    elements.append(Paragraph(
        "⚠ Investment information is educational only and not financial advice. Consult a licensed financial advisor.",
        ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=7, textColor=colors.HexColor('#ef4444'), alignment=TA_CENTER)
    ))

    doc.build(elements)


async def generate_excel_report(data: dict, filepath: str):
    """Generate an Excel financial report with charts"""
    await asyncio.to_thread(_create_excel, data, filepath)


def _create_excel(data: dict, filepath: str):
    wb = openpyxl.Workbook()
    currency = data["user"]["currency"]

    # ── Summary Sheet ─────────────────────────────────────────────────────────
    ws = wb.active
    ws.title = "Summary"
    ws.sheet_view.showGridLines = False
    
    # Colors
    green = PatternFill("solid", fgColor="16a34a")
    dark = PatternFill("solid", fgColor="1a1a2e")
    light_green = PatternFill("solid", fgColor="dcfce7")
    
    # Title
    ws.merge_cells("A1:F1")
    ws["A1"] = "FinAI Enterprise — Financial Report"
    ws["A1"].font = Font(bold=True, size=18, color="FFFFFF")
    ws["A1"].fill = dark
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 40
    
    ws.merge_cells("A2:F2")
    ws["A2"] = f"Period: {data['period']['start']} to {data['period']['end']} | {data['user']['name']}"
    ws["A2"].font = Font(size=11, color="6b7280")
    ws["A2"].alignment = Alignment(horizontal="center")
    ws.row_dimensions[2].height = 25
    
    # Summary metrics
    ws["A4"] = "FINANCIAL SUMMARY"
    ws["A4"].font = Font(bold=True, size=12, color="16a34a")
    
    metrics = [
        ("Total Income", f"{currency} {data['summary']['total_income']:,.2f}", "16a34a"),
        ("Total Expenses", f"{currency} {data['summary']['total_expenses']:,.2f}", "dc2626"),
        ("Net Savings", f"{currency} {data['summary']['net_savings']:,.2f}", "2563eb"),
        ("Savings Rate", f"{data['summary']['savings_rate']}%", "7c3aed"),
    ]
    
    for i, (label, value, color) in enumerate(metrics, start=5):
        ws[f"A{i}"] = label
        ws[f"A{i}"].font = Font(bold=True, size=11)
        ws[f"B{i}"] = value
        ws[f"B{i}"].font = Font(bold=True, size=11, color=color)
        ws[f"B{i}"].alignment = Alignment(horizontal="right")
    
    # Expense breakdown
    ws["A10"] = "EXPENSE BREAKDOWN"
    ws["A10"].font = Font(bold=True, size=12, color="7c3aed")
    
    ws["A11"] = "Category"
    ws["B11"] = "Amount"
    ws["C11"] = "% of Total"
    for cell in [ws["A11"], ws["B11"], ws["C11"]]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="7c3aed")
        cell.alignment = Alignment(horizontal="center")
    
    total_exp = data["summary"]["total_expenses"]
    sorted_cats = sorted(data.get("expense_by_category", {}).items(), key=lambda x: x[1], reverse=True)
    
    for row_idx, (cat, amount) in enumerate(sorted_cats, start=12):
        ws[f"A{row_idx}"] = cat.title()
        ws[f"B{row_idx}"] = amount
        ws[f"B{row_idx}"].number_format = f'"{currency}" #,##0.00'
        ws[f"C{row_idx}"] = f"{(amount / total_exp * 100):.1f}%" if total_exp > 0 else "0%"
        if row_idx % 2 == 0:
            ws[f"A{row_idx}"].fill = PatternFill("solid", fgColor="f5f3ff")
            ws[f"B{row_idx}"].fill = PatternFill("solid", fgColor="f5f3ff")
            ws[f"C{row_idx}"].fill = PatternFill("solid", fgColor="f5f3ff")
    
    # Column widths
    ws.column_dimensions["A"].width = 25
    ws.column_dimensions["B"].width = 20
    ws.column_dimensions["C"].width = 15

    # ── Transactions Sheet ────────────────────────────────────────────────────
    ws2 = wb.create_sheet("Expenses")
    headers = ["Date", "Title", "Category", "Amount", "Payment Method"]
    for col, header in enumerate(headers, 1):
        cell = ws2.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="16a34a")
        cell.alignment = Alignment(horizontal="center")
    
    for row_idx, e in enumerate(data.get("expenses", []), start=2):
        ws2.cell(row=row_idx, column=1, value=e["date"])
        ws2.cell(row=row_idx, column=2, value=e["title"])
        ws2.cell(row=row_idx, column=3, value=e["category"].title())
        ws2.cell(row=row_idx, column=4, value=e["amount"])
        ws2.cell(row=row_idx, column=5, value="N/A")
    
    for col in range(1, 6):
        ws2.column_dimensions[get_column_letter(col)].width = 18

    # ── Income Sheet ──────────────────────────────────────────────────────────
    ws3 = wb.create_sheet("Income")
    for col, header in enumerate(["Date", "Title", "Source", "Amount"], 1):
        cell = ws3.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1a1a2e")
    
    for row_idx, i in enumerate(data.get("income", []), start=2):
        ws3.cell(row=row_idx, column=1, value=i["date"])
        ws3.cell(row=row_idx, column=2, value=i["title"])
        ws3.cell(row=row_idx, column=3, value=i["source"].title())
        ws3.cell(row=row_idx, column=4, value=i["amount"])
    
    for col in range(1, 5):
        ws3.column_dimensions[get_column_letter(col)].width = 18

    wb.save(filepath)
