import { Card, SectionHeader } from '../ui'
import PeriodSelector from '../finance/PeriodSelector'
import { usePeriodData } from '../../hooks/useFinance'
import { useFinanceStore } from '../../store/financeStore'
import { getCategory, toCSV, analyzeBehavior, formatDateKey } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'

function download(name: string, text: string, type: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/**
 * Report for the selected period (daily / weekly / monthly / yearly / custom), generated on-device
 * from actual transactions. PDF via the browser's print-to-PDF; CSV opens in Excel.
 */
export default function PeriodReport() {
  const d = usePeriodData()
  const accounts = useFinanceStore(s => s.accounts)
  const s = d.summary
  const b = analyzeBehavior(d.txs, d.period, useFinanceStore.getState().transactions)
  const accName = (id?: string) => accounts.find(a => a.id === id)?.name || ''

  const summaryCSV = () => {
    const rows = [
      ['Report', d.period.label], ['From', d.period.start], ['To', d.period.end], [],
      ['Metric', 'Amount (LKR)'], ['Income', s.income], ['Expenses (gross)', s.expenses], ['Refunds & reimbursements', s.refunds],
      ['Net expenses', s.netExpenses], ['Savings', s.savings], ['Investments', s.investments], ['Net cash flow', s.netCashFlow],
      ['Savings rate %', s.savingsRate], ['Transfers (excluded)', s.transfers], [],
      ['Category', 'Net spent'], ...d.byCategory.map(c => [getCategory(c.category).label, c.total]), [],
      ['Budget', 'Budgeted', 'Spent'], ...d.budgetStatus.map(x => [getCategory(x.category).label, x.amount, x.spent]),
    ]
    return rows.map(r => r.join(',')).join('\n')
  }

  return (
    <Card className="print:shadow-none print:border-0" >
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4 print:hidden">
        <SectionHeader title="Period report" subtitle="Uses the selected period · generated from your transactions" />
        <PeriodSelector compact />
      </div>
      <div id="period-report" className="space-y-4 text-sm text-gray-800 dark:text-gray-200">
        <h2 className="text-xl font-bold">{d.period.label} — financial report</h2>
        <p className="text-xs text-gray-500">{formatDateKey(d.period.start, { year: true })} to {formatDateKey(d.period.end, { year: true })} · {s.count} transactions</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[['Income', s.income], ['Expenses', s.netExpenses], ['Savings', s.savings], ['Investments', s.investments], ['Net cash flow', s.netCashFlow], ['Remaining budget', d.remainingBudget ?? 0]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border dark:border-gray-700 p-2"><p className="text-xs text-gray-500">{l as string}</p><p className="font-semibold tabular-nums">{formatCurrency(v as number)}</p></div>
          ))}
        </div>
        <p>Savings rate: <b>{s.savingsRate.toFixed(1)}%</b> · Financial health: <b>{d.health.score}/100</b> · Net worth today: <b>{formatCurrency(d.netWorth.netWorth)}</b></p>
        <div>
          <p className="font-semibold mb-1">Spending by category</p>
          {d.byCategory.map(c => <div key={c.category} className="flex justify-between"><span>{getCategory(c.category).label}</span><span className="tabular-nums">{formatCurrency(c.total)}</span></div>)}
        </div>
        {d.budgetStatus.length > 0 && (
          <div><p className="font-semibold mb-1">Budget performance</p>
            {d.budgetStatus.map(x => <div key={x.id} className="flex justify-between"><span>{getCategory(x.category).label}</span><span className={`tabular-nums ${x.spent > x.amount ? 'text-red-600' : ''}`}>{formatCurrency(x.spent)} / {formatCurrency(x.amount)}</span></div>)}
          </div>
        )}
        <div><p className="font-semibold mb-1">Behaviour</p>
          <p>Weekend {formatCurrency(b.weekendAvgPerDay)}/day vs weekday {formatCurrency(b.weekdayAvgPerDay)}/day · {b.smallPurchases.count} small purchases ({formatCurrency(b.smallPurchases.total)}) · unexpected expenses {formatCurrency(b.unexpected.total)}</p>
        </div>
        {d.insights.length > 0 && (
          <div><p className="font-semibold mb-1">Insights & recommendations</p>
            {d.insights.map(i => <p key={i.id}>• [{i.kind === 'recommendation' ? 'SUGGESTION' : i.kind.toUpperCase()}] {i.detail} <span className="text-gray-400">({i.basis})</span></p>)}
          </div>
        )}
        <p className="text-[11px] text-gray-400">Expenses are net of refunds. Transfers are excluded from income and expenses. Predictions are estimates. Suggestions are general information, not personal financial advice.</p>
      </div>
      <div className="flex flex-wrap gap-2 mt-4 print:hidden">
        <button className="btn btn-primary" onClick={() => window.print()}>📄 PDF / Print</button>
        <button className="btn btn-secondary" onClick={() => download(`report-${d.period.start}_${d.period.end}.csv`, summaryCSV(), 'text/csv')}>📗 Summary (CSV/Excel)</button>
        <button className="btn btn-secondary" onClick={() => download(`transactions-${d.period.start}_${d.period.end}.csv`, toCSV(d.txs, accName), 'text/csv')}>📋 Transactions CSV</button>
        <button className="btn btn-secondary" onClick={() => download(`report-${d.period.start}_${d.period.end}.json`, JSON.stringify({ period: d.period, summary: s, categories: d.byCategory, budgets: d.budgetStatus, insights: d.insights, transactions: d.txs }, null, 2), 'application/json')}>JSON</button>
      </div>
    </Card>
  )
}
