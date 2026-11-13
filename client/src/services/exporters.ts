/**
 * Native report files generated in the browser from the selected period:
 *  - Excel (.xlsx, exceljs): Summary, Categories, Budgets, Transactions, Insights sheets
 *  - PDF (jspdf + autotable): formatted report with tables
 * Libraries are loaded on demand so they don't weigh on app start-up.
 */
import type { Transaction, PeriodSummary, Insight } from '../lib/finance'
import { getCategory } from '../lib/finance'

export interface ReportData {
  title: string
  start: string
  end: string
  currency: string
  summary: PeriodSummary
  categories: { category: string; total: number; count: number }[]
  budgets: { category: string; amount: number; spent: number }[]
  insights: Insight[]
  transactions: Transaction[]
  accountName: (id?: string) => string
  healthScore?: number
  netWorth?: number
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

const summaryRows = (d: ReportData): [string, number][] => [
  ['Income', d.summary.income], ['Expenses (gross)', d.summary.expenses], ['Refunds & reimbursements', d.summary.refunds],
  ['Net expenses', d.summary.netExpenses], ['Savings', d.summary.savings], ['Investments', d.summary.investments],
  ['Net cash flow', d.summary.netCashFlow], ['Transfers (excluded)', d.summary.transfers],
]

export async function exportXlsx(d: ReportData) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'FinanceFlow'; wb.created = new Date()
  const money = `#,##0.00`
  const head = (ws: any) => { ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; ws.views = [{ state: 'frozen', ySplit: 1 }] }

  const s = wb.addWorksheet('Summary')
  s.columns = [{ header: 'Metric', key: 'k', width: 30 }, { header: `Amount (${d.currency})`, key: 'v', width: 18, style: { numFmt: money } }]
  head(s)
  summaryRows(d).forEach(([k, v]) => s.addRow({ k, v }))
  s.addRow({ k: 'Savings rate %', v: Math.round(d.summary.savingsRate * 10) / 10 }).getCell('v').numFmt = '0.0'
  if (d.healthScore != null) s.addRow({ k: 'Financial health (0-100)', v: d.healthScore }).getCell('v').numFmt = '0'
  if (d.netWorth != null) s.addRow({ k: 'Net worth today', v: d.netWorth })
  s.addRow({}); s.addRow({ k: `Period: ${d.start} to ${d.end}` }); s.addRow({ k: `Transactions: ${d.summary.count}` })

  const c = wb.addWorksheet('Categories')
  c.columns = [{ header: 'Category', key: 'c', width: 28 }, { header: 'Net spent', key: 't', width: 16, style: { numFmt: money } }, { header: 'Count', key: 'n', width: 10 }, { header: '% of spending', key: 'p', width: 14, style: { numFmt: '0.0%' } }]
  head(c)
  const tot = d.categories.reduce((a, x) => a + x.total, 0) || 1
  d.categories.forEach(x => c.addRow({ c: getCategory(x.category).label, t: x.total, n: x.count, p: x.total / tot }))

  if (d.budgets.length) {
    const b = wb.addWorksheet('Budgets')
    b.columns = [{ header: 'Category', key: 'c', width: 28 }, { header: 'Budgeted', key: 'a', width: 16, style: { numFmt: money } }, { header: 'Spent', key: 's', width: 16, style: { numFmt: money } }, { header: 'Remaining', key: 'r', width: 16, style: { numFmt: money } }]
    head(b)
    d.budgets.forEach((x, i) => {
      const row = b.addRow({ c: getCategory(x.category).label, a: x.amount, s: x.spent })
      row.getCell('r').value = { formula: `B${i + 2}-C${i + 2}` } as any
    })
  }

  const t = wb.addWorksheet('Transactions')
  t.columns = [
    { header: 'Date', key: 'date', width: 12 }, { header: 'Type', key: 'type', width: 16 }, { header: 'Category', key: 'cat', width: 22 },
    { header: 'Description', key: 'desc', width: 32 }, { header: 'Merchant', key: 'm', width: 20 }, { header: 'Account', key: 'acc', width: 18 },
    { header: 'Amount', key: 'amt', width: 14, style: { numFmt: money } }, { header: 'Currency', key: 'cur', width: 9 },
    { header: `Base amount (${d.currency})`, key: 'base', width: 16, style: { numFmt: money } }, { header: 'Status', key: 'st', width: 10 },
  ]
  head(t)
  d.transactions.forEach(x => t.addRow({ date: x.date, type: x.type, cat: getCategory(x.category).label, desc: x.description || '', m: x.merchant || '', acc: d.accountName(x.accountId), amt: x.originalAmount ?? x.amount, cur: x.currency, base: x.amount, st: x.status }))
  t.autoFilter = { from: 'A1', to: 'J1' }

  if (d.insights.length) {
    const i = wb.addWorksheet('Insights')
    i.columns = [{ header: 'Kind', key: 'k', width: 16 }, { header: 'Insight', key: 'd', width: 80 }, { header: 'Basis', key: 'b', width: 40 }]
    head(i)
    d.insights.forEach(x => i.addRow({ k: x.kind === 'recommendation' ? 'SUGGESTION' : x.kind.toUpperCase(), d: x.detail, b: x.basis }))
  }

  const buf = await wb.xlsx.writeBuffer()
  save(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `financeflow-${d.start}_${d.end}.xlsx`)
}

export async function exportPdf(d: ReportData) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const fmt = (n: number) => `${d.currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const teal: [number, number, number] = [15, 118, 110]

  doc.setFillColor(...teal); doc.rect(0, 0, 595, 70, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text('FinanceFlow — Financial Report', 40, 34)
  doc.setFontSize(10); doc.text(`${d.title} · ${d.start} to ${d.end} · ${d.summary.count} transactions`, 40, 54)
  doc.setTextColor(30, 30, 30)

  autoTable(doc, {
    startY: 90, head: [['Metric', 'Amount']], body: [
      ...summaryRows(d).map(([k, v]) => [k, fmt(v)]),
      ['Savings rate', `${d.summary.savingsRate.toFixed(1)}%`],
      ...(d.healthScore != null ? [['Financial health', `${d.healthScore}/100`]] : []),
      ...(d.netWorth != null ? [['Net worth today', fmt(d.netWorth)]] : []),
    ], headStyles: { fillColor: teal }, columnStyles: { 1: { halign: 'right' } }, theme: 'striped',
  })
  const next = () => (doc as any).lastAutoTable.finalY + 24
  if (d.categories.length) autoTable(doc, { startY: next(), head: [['Category', 'Count', 'Net spent']], body: d.categories.map(c => [getCategory(c.category).label, String(c.count), fmt(c.total)]), headStyles: { fillColor: teal }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
  if (d.budgets.length) autoTable(doc, { startY: next(), head: [['Budget', 'Budgeted', 'Spent', 'Remaining']], body: d.budgets.map(b => [getCategory(b.category).label, fmt(b.amount), fmt(b.spent), fmt(b.amount - b.spent)]), headStyles: { fillColor: teal }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } })
  if (d.insights.length) autoTable(doc, { startY: next(), head: [['Insights & recommendations']], body: d.insights.map(i => [`[${i.kind === 'recommendation' ? 'SUGGESTION' : i.kind.toUpperCase()}] ${i.detail}`]), headStyles: { fillColor: teal } })
  autoTable(doc, {
    startY: next(), head: [['Date', 'Type', 'Category', 'Description', 'Amount']], styles: { fontSize: 8 },
    body: d.transactions.slice(0, 1000).map(t => [t.date, t.type.replace(/_/g, ' '), getCategory(t.category).label, (t.description || t.merchant || '').slice(0, 40), fmt(t.amount)]),
    headStyles: { fillColor: teal }, columnStyles: { 4: { halign: 'right' } },
  })
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(140)
    doc.text('Expenses are net of refunds; transfers excluded. Predictions are estimates; suggestions are general information, not financial advice.', 40, 820)
    doc.text(`${p}/${pages}`, 545, 820)
  }
  save(doc.output('blob'), `financeflow-${d.start}_${d.end}.pdf`)
}
