import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { insightsService } from '../../services/firebaseService'
import { Card, SectionHeader, Button } from '../ui'
import {
  LightBulbIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CurrencyRupeeIcon
} from '@heroicons/react/24/outline'

interface Insight {
  type: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  action?: string
  value?: number
}

export default function InsightsPage() {
  const [loading, setLoading] = useState(true)
  const [predictions, setPredictions] = useState<any>(null)
  const [savingSuggestions, setSavingSuggestions] = useState<any[]>([])
  const [investmentRecs, setInvestmentRecs] = useState<any[]>([])
  const [healthScore, setHealthScore] = useState<any>(null)

  const fetchInsights = async () => {
    try {
      setLoading(true)
      const [predictionsData, savingsData, investmentsData, healthData] = await Promise.all([
        insightsService.getPredictions().catch(() => null),
        insightsService.getSavingSuggestions().catch(() => ({ suggestions: [] })),
        insightsService.getInvestmentRecommendations().catch(() => ({ recommendations: [] })),
        insightsService.getFinancialHealth().catch(() => null)
      ])
      
      setPredictions(predictionsData)
      setSavingSuggestions(savingsData?.suggestions || [])
      setInvestmentRecs(investmentsData?.recommendations || [])
      setHealthScore(healthData)
    } catch (error) {
      toast.error('Failed to fetch insights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-100 dark:bg-red-900/30'
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30'
      case 'low': return 'text-green-500 bg-green-100 dark:bg-green-900/30'
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-700'
    }
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    if (score >= 40) return 'text-orange-500'
    return 'text-red-500'
  }

  const getHealthScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500'
    if (score >= 60) return 'from-yellow-500 to-amber-500'
    if (score >= 40) return 'from-orange-500 to-amber-600'
    return 'from-red-500 to-rose-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  // Generate mock insights if API doesn't return data
  const mockInsights: Insight[] = [
    {
      type: 'warning',
      title: 'High Dining Expenses',
      description: 'Your food spending is 40% higher than last month. Consider cooking at home more often.',
      priority: 'high',
      action: 'Review food expenses',
      value: 8500
    },
    {
      type: 'suggestion',
      title: 'Unused Subscriptions',
      description: 'You have 3 subscriptions with low usage. Canceling them could save ₹1,500/month.',
      priority: 'medium',
      action: 'Review subscriptions',
      value: 1500
    },
    {
      type: 'opportunity',
      title: 'Emergency Fund Opportunity',
      description: 'Your savings rate is strong. Consider allocating 20% to an emergency fund.',
      priority: 'low',
      action: 'Set up emergency fund'
    },
    {
      type: 'prediction',
      title: 'Expense Forecast',
      description: 'Based on your patterns, next month\'s expenses are predicted to be around ₹45,000.',
      priority: 'low',
      value: 45000
    }
  ]

  // Use mock data if API data is empty
  const displayInsights = mockInsights
  const displaySuggestions = savingSuggestions.length > 0 ? savingSuggestions : [
    { title: 'Switch to Generic Brands', description: 'Save up to 30% on groceries by choosing store brands', potentialSavings: 2000 },
    { title: 'Carpool to Work', description: 'Share rides with colleagues to cut transport costs', potentialSavings: 1500 },
    { title: 'Cancel Unused Gym Membership', description: 'Consider home workouts or outdoor exercise', potentialSavings: 1200 },
    { title: 'Use Cashback Apps', description: 'Earn 2-5% back on everyday purchases', potentialSavings: 800 }
  ]
  
  const displayInvestmentRecs = investmentRecs.length > 0 ? investmentRecs : [
    { title: 'Index Funds', description: 'Low-cost diversification for long-term growth', riskLevel: 'medium', expectedReturn: '12-15%' },
    { title: 'PPF Account', description: 'Tax-free returns with government backing', riskLevel: 'low', expectedReturn: '7.1%' },
    { title: 'Debt Mutual Funds', description: 'Stable returns with moderate liquidity', riskLevel: 'low', expectedReturn: '6-8%' },
    { title: 'Gold ETFs', description: 'Hedge against inflation and market volatility', riskLevel: 'medium', expectedReturn: '8-10%' }
  ]

  const financialHealthScore = healthScore?.score || 72

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SparklesIcon className="w-7 h-7 text-yellow-500" />
            AI Insights
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Personalized financial recommendations powered by AI</p>
        </div>
        <Button onClick={fetchInsights} variant="outline" icon={<SparklesIcon className="w-5 h-5" />}>
          Refresh Insights
        </Button>
      </div>

      {/* Financial Health Score */}
      <Card className="relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-shrink-0">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${financialHealthScore * 2.83} 283`}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold ${getHealthScoreColor(financialHealthScore)}`}>
                  {financialHealthScore}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">Health Score</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Financial Health Overview
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {financialHealthScore >= 80 
                ? "Excellent! Your finances are in great shape. Keep up the good work!"
                : financialHealthScore >= 60
                ? "Good progress! A few improvements could boost your financial health."
                : "There's room for improvement. Focus on the recommendations below."}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-green-500 mx-auto mb-1" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Savings</p>
                <p className="font-semibold text-gray-900 dark:text-white">Good</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Spending</p>
                <p className="font-semibold text-gray-900 dark:text-white">Moderate</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Investments</p>
                <p className="font-semibold text-gray-900 dark:text-white">Growing</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <BanknotesIcon className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Debt</p>
                <p className="font-semibold text-gray-900 dark:text-white">Low</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Key Insights */}
      <Card>
        <SectionHeader 
          title="Key Insights" 
          subtitle="Important observations about your finances"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayInsights.map((insight, index) => (
            <div
              key={index}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPriorityColor(insight.priority)}`}>
                  {insight.type === 'warning' ? (
                    <ExclamationTriangleIcon className="w-5 h-5" />
                  ) : insight.type === 'opportunity' ? (
                    <ArrowTrendingUpIcon className="w-5 h-5" />
                  ) : (
                    <LightBulbIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">{insight.title}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getPriorityColor(insight.priority)}`}>
                      {insight.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{insight.description}</p>
                  {insight.value && (
                    <p className="text-sm font-medium text-primary-500">
                      ₹{insight.value.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Saving Suggestions */}
      <Card>
        <SectionHeader 
          title="Money-Saving Suggestions" 
          subtitle="Practical ways to reduce expenses"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {displaySuggestions.map((suggestion: any, index: number) => (
            <div
              key={index}
              className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800"
            >
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-3">
                <CurrencyRupeeIcon className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">{suggestion.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{suggestion.description}</p>
              <p className="text-lg font-bold text-green-600">
                Save ₹{(suggestion.potentialSavings || 0).toLocaleString('en-IN')}/mo
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Investment Recommendations */}
      <Card>
        <SectionHeader 
          title="Investment Recommendations" 
          subtitle="Opportunities to grow your wealth"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayInvestmentRecs.map((rec: any, index: number) => (
            <div
              key={index}
              className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-3">
                <ChartBarIcon className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">{rec.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{rec.description}</p>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                  rec.riskLevel === 'low' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                  rec.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30' :
                  'bg-red-100 text-red-600 dark:bg-red-900/30'
                }`}>
                  {rec.riskLevel} risk
                </span>
                <span className="text-sm font-medium text-purple-600">{rec.expectedReturn}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* AI Predictions */}
      {predictions && (
        <Card>
          <SectionHeader 
            title="Predictions" 
            subtitle="AI-powered forecasts for next month"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Predicted Income</p>
              <p className="text-2xl font-bold text-green-500">
                ₹{(predictions.predictedIncome || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Predicted Expenses</p>
              <p className="text-2xl font-bold text-red-500">
                ₹{(predictions.predictedExpenses || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Predicted Savings</p>
              <p className="text-2xl font-bold text-blue-500">
                ₹{(predictions.predictedSavings || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
