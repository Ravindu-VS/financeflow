import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { analyticsService } from '../../services/firebaseService'
import { Card, SectionHeader, Button } from '../ui'
import { formatCurrency, formatAxisCurrency } from '../../utils/currency'
import {
  ChartBarIcon,
  CalendarDaysIcon,
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  ComposedChart
} from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1']

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const [overview, trends, categoryData] = await Promise.all([
        analyticsService.getOverview(),
        analyticsService.getTrends(period),
        analyticsService.getCategoryBreakdown()
      ])
      setData({ overview, trends, categoryData })
    } catch (error) {
      toast.error('Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  // Process trends data
  const trendsData = data?.trends?.monthlyData?.map((item: any) => ({
    name: new Date(item.year, item.month - 1).toLocaleString('default', { month: 'short' }),
    income: item.income,
    expense: item.expense,
    savings: item.income - item.expense
  })) || []

  // Category breakdown
  const categoryBreakdown = data?.categoryData?.expenseByCategory?.map((cat: any, index: number) => ({
    name: cat._id,
    value: cat.total,
    color: COLORS[index % COLORS.length]
  })) || []

  // Income sources
  const incomeSources = data?.categoryData?.incomeBySource?.map((src: any, index: number) => ({
    name: src._id,
    value: src.total,
    color: COLORS[index % COLORS.length]
  })) || []

  // Daily spending pattern (mock data - would come from API)
  const dailySpending = Array.from({ length: 7 }, (_, i) => ({
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
    amount: Math.floor(Math.random() * 2000) + 500
  }))

  const stats = data?.overview || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400">Deep insights into your finances</p>
        </div>
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Income</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(stats.totalIncome || 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <ArrowTrendingDownIcon className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Expenses</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(stats.totalExpenses || 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Savings Rate</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {stats.savingsRate?.toFixed(1) || 0}%
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <CalendarDaysIcon className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Daily Expense</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(stats.avgDailyExpense || 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Income vs Expense Trend */}
      <Card>
        <SectionHeader title="Income vs Expense Trend" subtitle="Monthly comparison" />
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendsData}>
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
              <Legend />
              <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" name="Income" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" name="Expense" />
              <Line type="monotone" dataKey="savings" stroke="#3b82f6" strokeWidth={2} dot={false} name="Savings" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionHeader title="Expense by Category" subtitle="Where your money goes" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryBreakdown.map((entry: any, index: number) => (
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

        <Card>
          <SectionHeader title="Income Sources" subtitle="Where your money comes from" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeSources} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} tickFormatter={(value) => formatAxisCurrency(value)} />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Daily Spending Pattern */}
      <Card>
        <SectionHeader title="Weekly Spending Pattern" subtitle="Daily average spending" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailySpending}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
              <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => formatAxisCurrency(value)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number) => [formatCurrency(value), 'Spending']}
              />
              <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top Expenses */}
      <Card>
        <SectionHeader title="Top Expense Categories" subtitle="Highest spending areas" />
        <div className="space-y-4">
          {categoryBreakdown.slice(0, 5).map((cat: any, index: number) => {
            const total = categoryBreakdown.reduce((sum: number, c: any) => sum + c.value, 0)
            const percentage = total > 0 ? (cat.value / total) * 100 : 0
            
            return (
              <div key={cat.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{cat.name}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    ₹{cat.value.toLocaleString('en-IN')} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${percentage}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
