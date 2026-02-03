import { useEffect } from 'react'
import { useDashboardStore } from '../../store/dashboardStore'
import { StatCard, Card, SectionHeader } from '../ui'
import { formatCurrency, formatAxisCurrency } from '../../utils/currency'
import {
  BanknotesIcon,
  CreditCardIcon,
  WalletIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1']

export default function Dashboard() {
  const { summary, cashflow, loading, fetchSummary, fetchCashflow } = useDashboardStore()

  useEffect(() => {
    fetchSummary()
    fetchCashflow()
  }, [fetchSummary, fetchCashflow])

  // Transform cashflow data for chart
  const cashflowData = cashflow?.monthlyData?.map(item => ({
    name: new Date(item.year, item.month - 1).toLocaleString('default', { month: 'short' }),
    income: item.income,
    expense: item.expense,
    savings: item.income - item.expense
  })) || []

  // Transform expense breakdown for pie chart
  const expenseByCategory = summary?.expenseByCategory?.map((cat, index) => ({
    name: cat._id,
    value: cat.total,
    color: COLORS[index % COLORS.length]
  })) || []

  // Recent transactions mock data (would come from API)
  const recentTransactions = [
    { id: 1, type: 'expense', category: 'Food', amount: 2500, date: '2024-01-15', description: 'Keells Super purchase' },
    { id: 2, type: 'income', category: 'Salary', amount: 185000, date: '2024-01-01', description: 'Monthly salary' },
    { id: 3, type: 'expense', category: 'Transport', amount: 5000, date: '2024-01-14', description: 'Petrol - Lanka IOC' },
    { id: 4, type: 'expense', category: 'Entertainment', amount: 1500, date: '2024-01-13', description: 'Dialog TV subscription' },
    { id: 5, type: 'expense', category: 'Bills', amount: 8500, date: '2024-01-10', description: 'CEB electricity bill' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Welcome back! Here's your financial overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Income"
          value={summary?.totalIncome || 0}
          icon={<BanknotesIcon className="w-6 h-6" />}
          trend={{ value: 12.5, isPositive: true }}
          color="green"
        />
        <StatCard
          title="Total Expenses"
          value={summary?.totalExpenses || 0}
          icon={<CreditCardIcon className="w-6 h-6" />}
          trend={{ value: 8.3, isPositive: false }}
          color="red"
        />
        <StatCard
          title="Net Savings"
          value={summary?.netSavings || 0}
          icon={<WalletIcon className="w-6 h-6" />}
          trend={{ value: 15.2, isPositive: true }}
          color="blue"
        />
        <StatCard
          title="Investments"
          value={summary?.investmentValue || 0}
          icon={<ChartBarIcon className="w-6 h-6" />}
          trend={{ value: 5.8, isPositive: true }}
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Chart */}
        <Card>
          <SectionHeader title="Cash Flow" subtitle="Income vs Expenses over time" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => formatAxisCurrency(value)} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" name="Income" />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" name="Expense" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <SectionHeader title="Expense Breakdown" subtitle="By category this month" />
          <div className="h-72 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {expenseByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <SectionHeader 
            title="Recent Transactions" 
            action={<a href="/expenses" className="text-sm text-primary-500 hover:text-primary-600">View all</a>}
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b dark:border-gray-700/50 last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          {tx.type === 'income' ? (
                            <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                          ) : (
                            <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <span className="text-gray-900 dark:text-white font-medium">{tx.description}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400 text-sm">
                      {new Date(tx.date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className={`py-3 text-right font-medium ${
                      tx.type === 'income' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Actions & Goals */}
        <Card>
          <SectionHeader title="Savings Goals" />
          <div className="space-y-4">
            {(summary?.savingsGoals || []).slice(0, 3).map((goal: any) => (
              <div key={goal._id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{goal.name}</span>
                  <span className="text-gray-500">
                    {formatCurrency(goal.currentAmount || 0)} / {formatCurrency(goal.targetAmount || 0)}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-green rounded-full transition-all"
                    style={{ width: `${Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {(!summary?.savingsGoals || summary.savingsGoals.length === 0) && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <WalletIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No savings goals yet</p>
                <a href="/savings" className="text-primary-500 hover:text-primary-600 text-sm">
                  Create your first goal
                </a>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
