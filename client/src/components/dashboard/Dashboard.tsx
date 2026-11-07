import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { BanknotesIcon, CreditCardIcon, WalletIcon, ChartBarIcon, ArrowsRightLeftIcon, ChartPieIcon } from '@heroicons/react/24/outline'
import { Card, SectionHeader, StatCard } from '../ui'
import PeriodSelector from '../finance/PeriodSelector'
import MigrationBanner from '../finance/MigrationBanner'
import { TransactionRow } from '../finance/TransactionList'
import { usePeriodData } from '../../hooks/useFinance'
import { useQuickAdd } from '../../store/quickAddStore'
import { formatCurrency, formatAxisCurrency } from '../../utils/currency'
import { dailySeries, monthlySeries, getCategory, formatDateKey } from '../../lib/finance'
import { payBill } from '../../services/transactionActions'

const KIND_BADGE: Record<string, string> = { fact: 'FACT', prediction: 'PREDICTION', recommendation: 'SUGGESTION' }
const KIND_CLS: Record<string, string> = {
  fact: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  prediction: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  recommendation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

export default function Dashboard() {
  const d = usePeriodData()
  const { open } = useQuickAdd()
  const cmpLabel = d.comparisonLabel.startsWith('vs same') ? 'vs same day last period' : 'vs previous period'
  const trend = (v: number | null, lowerIsBetter = false) =>
    v === null || !isFinite(v) ? null : { value: v, isPositive: lowerIsBetter ? v <= 0 : v >= 0, label: cmpLabel }
  const s = d.summary
  const long = d.period.unit === 'year' || d.period.preset === 'last_6_months' || d.period.preset === 'last_3_months'
  const trendData = long
    ? monthlySeries(d.txs, d.period).map(m => ({ name: m.month.slice(5), Income: m.income, Expenses: m.netExpenses }))
    : (() => { let run = 0; return dailySeries(d.txs, d.period).map(x => ({ name: x.date.slice(8), Expenses: (run += x.expenses) })) })()
  const pie = d.byCategory.slice(0, 7).map(c => ({ name: getCategory(c.category).label, value: c.total, color: getCategory(c.category).color }))
  const otherTotal = d.byCategory.slice(7).reduce((a, c) => a + c.total, 0)
  if (otherTotal) pie.push({ name: 'Other categories', value: otherTotal, color: '#9ca3af' })
  const recent = [...d.txs].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8)
  const bills = d.upcoming.filter(u => u.rule.type === 'expense').slice(0, 6)

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Welcome back! Here's how you're doing {d.isCurrentMonth ? 'this month' : `in ${d.period.label}`}.</p>
        </div>
        <PeriodSelector />
      </div>

      <MigrationBanner />

      {/* Top cards — original StatCard design, now period-aware with real comparisons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard title="Income" value={s.income} color="green" icon={<BanknotesIcon className="w-6 h-6" />} trend={trend(d.change.income)} />
        <StatCard title="Expenses" value={s.netExpenses} color="red" icon={<CreditCardIcon className="w-6 h-6" />} trend={trend(d.change.expenses, true)} />
        <StatCard title="Savings" value={s.savings} color="blue" icon={<WalletIcon className="w-6 h-6" />} trend={trend(d.change.savings)} hint={`Savings rate ${s.savingsRate.toFixed(0)}%`} />
        <StatCard title="Investments" value={s.investments} color="purple" icon={<ChartBarIcon className="w-6 h-6" />} trend={trend(d.change.investments)} hint={s.investments ? undefined : "Nothing invested this period"} />
        <StatCard title="Net Cash Flow" value={s.netCashFlow} color={s.netCashFlow >= 0 ? 'teal' : 'red'} icon={<ArrowsRightLeftIcon className="w-6 h-6" />} hint="Income − expenses" />
        <StatCard title="Remaining Budget" value={d.remainingBudget} color="amber" icon={<ChartPieIcon className="w-6 h-6" />} hint={d.totalBudget ? `of ${formatCurrency(d.totalBudget)} budgeted` : 'No budget set yet'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Safe to spend / available */}
        <Card>
          <SectionHeader title={d.isCurrentMonth ? 'Safe to Spend' : 'Available Cash'} subtitle={d.isCurrentMonth ? 'Estimate for the rest of this month' : 'Spendable account balances today'} />
          {d.isCurrentMonth ? (
            <div className="space-y-2">
              <p className="text-3xl font-bold text-primary-600 tabular-nums">{formatCurrency(d.safeToSpend.safeToSpend)}</p>
              <p className="text-sm text-gray-500">≈ {formatCurrency(Math.floor(d.safeToSpend.dailyLimit))} / day for {d.safeToSpend.daysLeft} days</p>
              <div className="text-xs text-gray-500 space-y-0.5 pt-2 border-t dark:border-gray-700">
                <div className="flex justify-between"><span>Available cash</span><span className="tabular-nums">{formatCurrency(d.safeToSpend.availableCash)}</span></div>
                <div className="flex justify-between"><span>− Upcoming essential bills</span><span className="tabular-nums">{formatCurrency(d.safeToSpend.upcomingBills)}</span></div>
                <div className="flex justify-between"><span>− Savings still planned</span><span className="tabular-nums">{formatCurrency(d.safeToSpend.savingsCommitment)}</span></div>
                <div className="flex justify-between"><span>− Investments still planned</span><span className="tabular-nums">{formatCurrency(d.safeToSpend.investmentCommitment)}</span></div>
                <div className="flex justify-between"><span>− Emergency reserve</span><span className="tabular-nums">{formatCurrency(d.safeToSpend.emergencyReserve)}</span></div>
              </div>
              <p className="text-[11px] text-gray-400">Estimate, not a guarantee. Set targets & reserve in <Link to="/planning" className="text-primary-500">Planning</Link>.</p>
            </div>
          ) : (
            <p className="text-3xl font-bold text-primary-600">{formatCurrency(d.cash)}</p>
          )}
        </Card>

        {/* Budget status */}
        <Card>
          <SectionHeader title="Budget Status" action={<Link to="/budgets" className="text-sm text-primary-500">Manage</Link>} />
          {d.budgetStatus.length ? (
            <div className="space-y-3">
              {d.budgetStatus.slice(0, 5).map(b => (
                <div key={b.id}>
                  <div className="flex justify-between text-sm"><span className="text-gray-700 dark:text-gray-200">{getCategory(b.category).icon} {getCategory(b.category).label}</span><span className="tabular-nums text-gray-500">{formatCurrency(b.spent)} / {formatCurrency(b.amount)}</span></div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                    <div className={`h-full rounded-full ${b.pct >= 100 ? 'bg-red-500' : b.pct >= 80 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, b.pct)}%` }} />
                  </div>
                  {b.forecast !== undefined && b.forecast > b.amount && b.spent <= b.amount && <p className="text-[11px] text-amber-600 mt-0.5">Forecast {formatCurrency(b.forecast)} — may exceed by {formatCurrency(b.forecast - b.amount)}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">No budgets yet. <Link className="text-primary-500" to="/budgets">Create one</Link></p>}
        </Card>

        {/* AI insight */}
        <Card>
          <SectionHeader title="Insights" subtitle="From your actual transactions" action={<Link to="/insights" className="text-sm text-primary-500">More</Link>} />
          {d.insights.length ? (
            <div className="space-y-3">
              {d.insights.slice(0, 3).map(i => (
                <div key={i.id} className="text-sm">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${KIND_CLS[i.kind]}`}>{KIND_BADGE[i.kind]}</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-1">{i.detail}</p>
                  <p className="text-[11px] text-gray-400">Based on: {i.basis}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">Add a few transactions to see insights.</p>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeader title="Expense Breakdown" subtitle={d.period.label} />
          {pie.length ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-52 w-52 shrink-0">
                <ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={2}>{pie.map(p => <Cell key={p.name} fill={p.color} />)}</Pie><Tooltip formatter={(v: number) => formatCurrency(v)} /></PieChart></ResponsiveContainer>
              </div>
              <div className="flex-1 w-full space-y-1.5 text-sm">
                {pie.map(p => (
                  <div key={p.name} className="flex justify-between gap-2"><span className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />{p.name}</span><span className="tabular-nums text-gray-500">{formatCurrency(p.value)} · {s.netExpenses ? Math.round(p.value / s.netExpenses * 100) : 0}%</span></div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-gray-500 py-8 text-center">No expenses in this period</p>}
        </Card>

        <Card>
          <SectionHeader title="Cash Flow" subtitle={long ? 'Income vs expenses by month' : 'Spending so far this period (running total)'} />
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={formatAxisCurrency} width={55} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} formatter={(v: number) => [formatCurrency(v), '']} />
                {long && <Area type="monotone" dataKey="Income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" name="Income" />}
                <Area type="monotone" dataKey="Expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionHeader title="Recent Transactions" action={<Link to="/transactions" className="text-sm text-primary-500">View all</Link>} />
          {recent.length ? <div className="divide-y divide-gray-100 dark:divide-gray-700">{recent.map(t => <TransactionRow key={t.id} t={t} />)}</div> : (
            <div className="text-center py-8 text-gray-500">
              <p>No transactions in {d.period.label}</p>
              <div className="flex gap-3 justify-center mt-3">
                <button className="btn btn-primary py-2" onClick={() => open('expense')}>+ Expense</button>
                <button className="btn btn-secondary py-2" onClick={() => open('income')}>+ Income</button>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <SectionHeader title="Upcoming Bills" subtitle="Next 30 days" action={<Link to="/planning" className="text-sm text-primary-500">All</Link>} />
            {bills.length ? (
              <div className="space-y-2">
                {bills.map(b => (
                  <div key={b.rule.id + b.date} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0"><p className="truncate text-gray-800 dark:text-gray-200">{b.rule.description}</p><p className="text-xs text-gray-500">{formatDateKey(b.date, { weekday: true })}{b.rule.variableAmount ? ' · est.' : ''}</p></div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{formatCurrency(b.rule.amount)}</span>
                      {!b.rule.autoGenerate && <button className="text-xs text-primary-600 border border-primary-300 rounded px-2 py-1" onClick={async () => { try { await payBill(b.rule, b.date); toast.success('Marked as paid') } catch (e: any) { toast.error(e.message) } }}>Paid</button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">No upcoming bills. Add one with Quick Add → Bill.</p>}
          </Card>

          <Card>
            <SectionHeader title="Savings Progress" action={<Link to="/savings" className="text-sm text-primary-500">Goals</Link>} />
            <p className="text-sm text-gray-500 mb-2">Savings rate this period: <span className="font-semibold text-gray-800 dark:text-gray-200">{s.savingsRate.toFixed(0)}%</span></p>
            {d.goalProgress.slice(0, 3).map(g => (
              <div key={g.id} className="mb-2">
                <div className="flex justify-between text-sm"><span className="text-gray-700 dark:text-gray-300">{g.name}</span><span className="text-gray-500">{g.pct}%</span></div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${g.pct}%` }} /></div>
                {g.perMonth > 0 && <p className="text-[11px] text-gray-400">Needs {formatCurrency(g.perMonth)}/month to reach on time</p>}
              </div>
            ))}
            {!d.goalProgress.length && <p className="text-sm text-gray-500"><Link to="/savings" className="text-primary-500">Create a savings goal</Link></p>}
          </Card>

          <Card>
            <SectionHeader title="Financial Health" subtitle="Transparent score from your data" />
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{d.health.score}<span className="text-base text-gray-400">/100</span></p>
            <div className="text-xs text-gray-500 space-y-0.5 mt-2">{d.health.factors.map(f => <p key={f.label}>{f.label}: {f.detail}</p>)}</div>
            <p className="text-xs text-gray-500 mt-2">Net worth: <span className="font-semibold">{formatCurrency(d.netWorth.netWorth)}</span> · <Link to="/accounts" className="text-primary-500">Accounts</Link></p>
          </Card>
        </div>
      </div>
    </div>
  )
}
