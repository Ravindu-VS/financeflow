import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../../store/enterpriseStore'
import { useEnterpriseStore } from '../../store/enterpriseStore'
import { runSync } from '../../hooks/useBackendSync'
import { usePeriodData } from '../../hooks/useFinance'
import { makePeriod, todayKey } from '../../lib/finance'

const gradeFor = (s: number) => s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F'

export default function FinancialHealthPage() {
  const { fetchHealthScore } = useEnterpriseStore()
  const [details, setDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'server' | 'device' | null>(null)
  const period = useMemo(() => makePeriod('this_month', todayKey()), [])
  const local = usePeriodData(period).health
  const healthScore: number | null = source === 'server' ? details?.score ?? null : source === 'device' ? local.score : null
  const healthGrade: string | null = source === 'server' ? details?.grade ?? (healthScore != null ? gradeFor(healthScore) : null) : healthScore != null ? gradeFor(healthScore) : null

  const calculateScore = async () => {
    setLoading(true)
    try {
      await runSync().catch(() => undefined) // score the latest data
      const { data } = await apiClient.get('/api/v1/health-score/calculate')
      setDetails(data); setSource('server')
      fetchHealthScore()
    } catch {
      // Server unreachable: the same transparent rule-based score, computed on this device
      setDetails({
        recommendations: local.factors.filter(f => f.points < 10).map(f => ({ priority: f.points === 0 ? 'high' : 'medium', action: `${f.label}: ${f.detail}` })),
        factors: local.factors,
      })
      setSource('device')
    } finally { setLoading(false) }
  }
  useEffect(() => { calculateScore() }, [])

  const gradeColor = (grade: string) => {
    const colors: Record<string, string> = { 'A+': 'text-emerald-400', 'A': 'text-green-400', 'B': 'text-yellow-400', 'C': 'text-orange-400', 'D': 'text-red-400', 'F': 'text-red-600' }
    return colors[grade] || 'text-gray-600 dark:text-gray-400'
  }

  const scoreGradient = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-green-600'
    if (score >= 60) return 'from-yellow-500 to-orange-500'
    return 'from-red-500 to-red-600'
  }

  const DIMENSIONS = [
    { key: 'saving_rate', label: 'Saving Rate', icon: '💰', weight: '25%' },
    { key: 'expense_ratio', label: 'Expense Ratio', icon: '💸', weight: '20%' },
    { key: 'budget_discipline', label: 'Budget Discipline', icon: '📊', weight: '20%' },
    { key: 'investment', label: 'Investment Activity', icon: '📈', weight: '20%' },
    { key: 'emergency_fund', label: 'Emergency Fund', icon: '🛡️', weight: '15%' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financial Health Score</h1>
        <p className="text-gray-600 dark:text-gray-400">AI-powered comprehensive analysis of your financial wellbeing</p>
        <p className="text-xs text-gray-500">{source === 'device' ? 'Calculated on this device (server unreachable)' : source === 'server' ? 'Calculated by the FinAI backend from your synced data' : 'Calculating…'}</p>
      </div>

      {/* Main Score */}
      <div className="bg-white shadow-sm dark:shadow-none dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-8 flex flex-col items-center gap-6">
        <div className="relative">
          <div className={`w-48 h-48 rounded-full bg-gradient-to-br ${scoreGradient(healthScore || 0)} flex flex-col items-center justify-center shadow-2xl`}
            style={{ boxShadow: `0 0 60px ${(healthScore || 0) >= 80 ? 'rgba(16,185,129,0.3)' : (healthScore || 0) >= 60 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <span className="text-white text-6xl font-black">{healthScore || '--'}</span>
            <span className="text-white/70 text-sm">out of 100</span>
          </div>
          {healthGrade && (
            <div className={`absolute -top-2 -right-2 w-12 h-12 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-xl font-black ${gradeColor(healthGrade)}`}>
              {healthGrade}
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-gray-900 dark:text-white text-xl font-bold">
            {(healthScore || 0) >= 80 ? '🌟 Excellent Financial Health!' :
             (healthScore || 0) >= 60 ? '✅ Good Financial Health' :
             (healthScore || 0) >= 40 ? '⚠️ Needs Improvement' : '🚨 Urgent Attention Required'}
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            {(healthScore || 0) >= 80 ? "You're managing your finances exceptionally well. Keep it up!" :
             (healthScore || 0) >= 60 ? "Good foundation. Focus on the red areas to improve your score." :
             "Take immediate steps to improve your financial health."}
          </p>
        </div>

        <button
          onClick={calculateScore}
          disabled={loading}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2"
        >
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '🔄'}
          {loading ? 'Calculating...' : 'Recalculate Score'}
        </button>
      </div>

      {/* Dimension Breakdown */}
      {details?.breakdown && (
        <div>
          <h2 className="text-gray-900 dark:text-white font-bold text-lg mb-4">Score Breakdown</h2>
          <div className="space-y-4">
            {DIMENSIONS.map(dim => {
              const data = details.breakdown[dim.key]
              const score = data?.score || 0
              return (
                <div key={dim.key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{dim.icon}</span>
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium text-sm">{dim.label}</p>
                        <p className="text-gray-500 text-xs">Weight: {dim.weight}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-2xl font-bold ${score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{score}</span>
                      <span className="text-gray-600 text-sm">/100</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${score >= 80 ? 'from-green-500 to-emerald-400' : score >= 60 ? 'from-yellow-500 to-orange-400' : 'from-red-600 to-red-500'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  {data?.message && <p className="text-gray-500 text-xs mt-2">{data.message}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* On-device factor breakdown */}
      {source === 'device' && details?.factors && (
        <div>
          <h2 className="text-gray-900 dark:text-white font-bold text-lg mb-4">Score Breakdown</h2>
          <div className="space-y-3">
            {details.factors.map((f: any) => (
              <div key={f.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div><p className="text-gray-900 dark:text-white font-medium text-sm">{f.label}</p><p className="text-gray-500 text-xs mt-0.5">{f.detail}</p></div>
                <span className="text-xl font-bold text-teal-400 tabular-nums">+{f.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {details?.recommendations && details.recommendations.length > 0 && (
        <div>
          <h2 className="text-gray-900 dark:text-white font-bold text-lg mb-4">🎯 AI Recommendations</h2>
          <div className="space-y-3">
            {details.recommendations.map((rec: any, i: number) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-2xl border ${
                rec.priority === 'urgent' ? 'bg-red-500/5 border-red-500/20' :
                rec.priority === 'high' ? 'bg-orange-500/5 border-orange-500/20' : 'bg-blue-500/5 border-blue-500/20'
              }`}>
                <span className="text-lg mt-0.5">{rec.priority === 'urgent' ? '🚨' : rec.priority === 'high' ? '⚠️' : '💡'}</span>
                <div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                    rec.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                    rec.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>{rec.priority}</span>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">{rec.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
