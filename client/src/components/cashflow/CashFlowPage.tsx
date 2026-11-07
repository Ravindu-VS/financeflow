import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid, LineChart, Line } from 'recharts'
import { Card, SectionHeader } from '../ui'
import PeriodSelector from '../finance/PeriodSelector'
import { usePeriodData } from '../../hooks/useFinance'
import { useFinanceStore } from '../../store/financeStore'
import { cashFlowStatement, dailySeries, balancesAsOf, availableCash, formatDateKey } from '../../lib/finance'
import { formatCurrency, formatAxisCurrency } from '../../utils/currency'

/** Where did my money go? Opening balance → flows → closing balance for spendable accounts. */
export default function CashFlowPage() {
  const d = usePeriodData()
  const { transactions, windowStart } = useFinanceStore()
  const exact = d.period.start >= windowStart
  const source = exact ? transactions : d.txs
  const cf = useMemo(() => cashFlowStatement(d.accounts, source, d.period, d.balances), [d.accounts, source, d.period, d.balances])

  const steps = [
    { name: 'Opening', value: cf.openingBalance, kind: 'total' },
    { name: 'Income', value: cf.income, kind: 'in' },
    { name: 'Refunds', value: cf.refunds, kind: 'in' },
    { name: 'Expenses', value: -cf.expenses, kind: 'out' },
    { name: 'Savings', value: -cf.savings, kind: 'out' },
    { name: 'Investments', value: -cf.investments, kind: 'out' },
    { name: 'Transfers', value: cf.transfersIn - cf.transfersOut, kind: cf.transfersIn - cf.transfersOut >= 0 ? 'in' : 'out' },
    ...(cf.adjustments ? [{ name: 'Adjustments', value: cf.adjustments, kind: cf.adjustments >= 0 ? 'in' : 'out' }] : []),
    { name: 'Closing', value: cf.closingBalance, kind: 'total' },
  ]
  // waterfall: invisible base + visible delta
  let run = 0
  const water = steps.map(s => {
    if (s.kind === 'total') { run = s.value; return { name: s.name, base: 0, delta: s.value, kind: s.kind, raw: s.value } }
    const start = run; run += s.value
    return { name: s.name, base: Math.min(start, run), delta: Math.abs(s.value), kind: s.kind, raw: s.value }
  })
  const color = (k: string) => (k === 'total' ? '#6366f1' : k === 'in' ? '#10b981' : '#ef4444')

  const balanceLine = useMemo(() => {
    if (!exact) return []
    const spend = d.accounts.filter(a => ['cash', 'bank', 'debit_card', 'ewallet', 'credit_card'].includes(a.type))
    return dailySeries(d.txs, d.period).filter((_, i, arr) => arr.length <= 62 || i % 7 === 0).map(x => ({
      name: x.date.slice(5), Balance: availableCash(spend, balancesAsOf(d.balances, transactions, x.date)),
    }))
  }, [exact, d.txs, d.period, d.balances, transactions, d.accounts])

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cash Flow</h1>
          <p className="text-sm text-gray-500">Where your money went · {formatDateKey(d.period.start, { year: true })} – {formatDateKey(d.period.end, { year: true })}</p>
        </div>
        <PeriodSelector />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <SectionHeader title="Statement" subtitle="Spendable accounts (cash, bank, cards, wallets)" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              <tr><td className="py-2 font-medium">Opening balance</td><td className="text-right tabular-nums font-medium">{formatCurrency(cf.openingBalance)}</td></tr>
              <tr><td className="py-2 text-green-600">+ Income</td><td className="text-right tabular-nums">{formatCurrency(cf.income)}</td></tr>
              {cf.refunds > 0 && <tr><td className="py-2 text-green-600">+ Refunds & reimbursements</td><td className="text-right tabular-nums">{formatCurrency(cf.refunds)}</td></tr>}
              <tr><td className="py-2 text-red-600">− Expenses</td><td className="text-right tabular-nums">{formatCurrency(cf.expenses)}</td></tr>
              <tr><td className="py-2 text-emerald-600">− Moved to savings</td><td className="text-right tabular-nums">{formatCurrency(cf.savings)}</td></tr>
              <tr><td className="py-2 text-blue-600">− Invested</td><td className="text-right tabular-nums">{formatCurrency(cf.investments)}</td></tr>
              <tr><td className="py-2 text-gray-500">± Transfers (in {formatCurrency(cf.transfersIn)} / out {formatCurrency(cf.transfersOut)})</td><td className="text-right tabular-nums">{formatCurrency(cf.transfersIn - cf.transfersOut)}</td></tr>
              {cf.adjustments !== 0 && <tr><td className="py-2 text-gray-500">± Adjustments</td><td className="text-right tabular-nums">{formatCurrency(cf.adjustments)}</td></tr>}
              <tr><td className="py-2 font-semibold">Closing balance</td><td className="text-right tabular-nums font-semibold">{formatCurrency(cf.closingBalance)}</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">Transfers between your spendable accounts cancel out and never count as income or expense.</p>
          {!exact && <p className="text-xs text-amber-600 mt-1">Opening/closing for periods older than 13 months are computed from cached balances and may be approximate.</p>}
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader title="Opening + Income − Expenses − Savings − Investments = Closing" />
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={water}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" fontSize={11} stroke="#9ca3af" />
                <YAxis fontSize={11} stroke="#9ca3af" tickFormatter={formatAxisCurrency} width={60} />
                <Tooltip formatter={(_v: number, _n, p: any) => formatCurrency(p.payload.raw)} />
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="delta" stackId="a">{water.map(w => <Cell key={w.name} fill={color(w.kind)} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {balanceLine.length > 1 && (
        <Card>
          <SectionHeader title="Available cash over the period" />
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={balanceLine}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" fontSize={11} stroke="#9ca3af" />
                <YAxis fontSize={11} stroke="#9ca3af" tickFormatter={formatAxisCurrency} width={60} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="Balance" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  )
}
