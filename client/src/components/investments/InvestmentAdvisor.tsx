import { useMemo, useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Card, SectionHeader } from '../ui'
import { usePeriodData } from '../../hooks/useFinance'
import { useFinanceStore } from '../../store/financeStore'
import { settingsService } from '../../services/financeService'
import { investmentPlan, summarize, addMonths, startOfMonth, todayKey, legacyToDateKey, ASSET_CLASSES, type RiskProfile } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'

const STAGE = {
  build_emergency_fund: { label: 'Step 1 · Build your emergency fund', color: 'from-amber-500 to-orange-500' },
  pay_debt: { label: 'Step 2 · Clear high-cost debt', color: 'from-rose-500 to-red-500' },
  invest: { label: 'Step 3 · Invest regularly', color: 'from-teal-500 to-emerald-600' },
}
const COLORS: Record<string, string> = { cash: '#64748b', fixed: '#0ea5e9', equity: '#10b981', gold: '#f59e0b' }

/** Rule-based, explained investment guidance from the user's own numbers (educational, not advice). */
export default function InvestmentAdvisor() {
  const d = usePeriodData()
  const { transactions, holdings, settings } = useFinanceStore()
  const [profile, setProfile] = useState<RiskProfile>(settings.riskProfile || { tolerance: 'moderate', horizonYears: 5, experience: 'some' })
  useEffect(() => { if (settings.riskProfile) setProfile(settings.riskProfile) }, [settings.riskProfile])
  const today = todayKey()

  const plan = useMemo(() => {
    const thisMonth = startOfMonth(today), from = addMonths(thisMonth, -3, 1)
    const hist = transactions.filter(t => t.date >= from && t.date < thisMonth)
    const months = new Set(hist.map(t => t.date.slice(0, 7))).size || 1
    const s = summarize(hist)
    const active = holdings.filter(h => h.status !== 'sold')
    return investmentPlan({
      profile, today,
      avgMonthlyIncome: s.income / months, avgMonthlyExpenses: s.netExpenses / months,
      availableCash: d.cash, debt: d.netWorth.liabilities,
      investedValue: active.reduce((a, h) => a + (Number(h.currentValue) || Number(h.amount) || 0), 0),
      holdings: active.map(h => ({ name: h.name, amount: Number(h.amount) || 0, currentValue: Number(h.currentValue) || undefined, purchaseDate: legacyToDateKey(h.purchaseDate) })),
    })
  }, [profile, transactions, holdings, d.cash, d.netWorth.liabilities, today])

  const saveProfile = async (p: RiskProfile) => {
    setProfile(p)
    try { await settingsService.save({ riskProfile: p }) } catch { toast.error('Could not save profile') }
  }
  const st = STAGE[plan.stage]

  return (
    <Card>
      <SectionHeader title="🧭 Investment advisor" subtitle="Built from your last 3 months of income and spending · educational, not financial advice" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <label className="text-sm">Risk tolerance
          <select className="input mt-1" value={profile.tolerance} onChange={e => saveProfile({ ...profile, tolerance: e.target.value as any })}>
            <option value="conservative">Conservative</option><option value="moderate">Moderate</option><option value="aggressive">Aggressive</option>
          </select></label>
        <label className="text-sm">Time horizon
          <select className="input mt-1" value={profile.horizonYears} onChange={e => saveProfile({ ...profile, horizonYears: Number(e.target.value) })}>
            {[1, 3, 5, 10, 15, 20].map(y => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
          </select></label>
        <label className="text-sm">Experience
          <select className="input mt-1" value={profile.experience} onChange={e => saveProfile({ ...profile, experience: e.target.value as any })}>
            <option value="none">New to investing</option><option value="some">Some</option><option value="experienced">Experienced</option>
          </select></label>
      </div>

      <div className={`rounded-2xl p-4 text-white bg-gradient-to-r ${st.color}`}>
        <p className="text-xs uppercase tracking-wide opacity-90">{st.label}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <div><p className="text-xs opacity-80">Monthly surplus</p><p className="text-lg font-bold tabular-nums">{formatCurrency(plan.monthlySurplus)}</p></div>
          <div><p className="text-xs opacity-80">Emergency fund target</p><p className="text-lg font-bold tabular-nums">{formatCurrency(plan.emergencyTarget)}</p></div>
          <div><p className="text-xs opacity-80">Put aside / month</p><p className="text-lg font-bold tabular-nums">{formatCurrency(plan.suggestedMonthlyEmergency)}</p></div>
          <div><p className="text-xs opacity-80">Invest / month</p><p className="text-lg font-bold tabular-nums">{formatCurrency(plan.suggestedMonthlyInvestment)}</p></div>
        </div>
      </div>

      <ol className="mt-4 space-y-1.5 list-decimal pl-5 text-sm text-gray-700 dark:text-gray-300">{plan.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>

      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <div>
          <p className="font-medium mb-2">Suggested mix · expected ≈{plan.expectedAnnualReturn}%/yr</p>
          <div className="flex h-3 rounded-full overflow-hidden mb-2">{plan.allocation.map(a => <div key={a.id} style={{ width: `${a.pct}%`, background: COLORS[a.id] }} title={`${a.label} ${a.pct}%`} />)}</div>
          {plan.allocation.map(a => (
            <div key={a.id} className="flex justify-between text-sm py-1">
              <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: COLORS[a.id] }} />{a.label} <span className="text-xs text-gray-500">({a.examples})</span></span>
              <span className="tabular-nums">{a.pct}% · {formatCurrency(a.monthly)}/mo</span>
            </div>
          ))}
        </div>
        <div>
          <p className="font-medium mb-2">In {profile.horizonYears} year{profile.horizonYears > 1 ? 's' : ''} (PREDICTION)</p>
          {plan.scenarios.map(s => (
            <div key={s.label} className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <span>{s.label} <span className="text-xs text-gray-500">@ {s.rate}%/yr</span></span>
              <span className="tabular-nums font-medium">{formatCurrency(s.value)}</span>
            </div>
          ))}
          <p className="text-xs text-gray-500 mt-1">You would contribute {formatCurrency(plan.scenarios[0]?.contributed || 0)} in total. Assumed long-run returns: {ASSET_CLASSES.map(c => `${c.label} ${Math.round(c.expectedReturn * 100)}%`).join(', ')}.</p>
        </div>
      </div>

      {plan.holdings.length > 0 && (
        <div className="mt-5">
          <p className="font-medium mb-2">Your holdings · return on investment</p>
          {plan.holdings.map((h, i) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span>{h.name}</span>
              <span className={`tabular-nums ${h.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>{h.gain >= 0 ? '+' : ''}{formatCurrency(h.gain)} · {h.roi}%{h.annualized != null ? ` · ${h.annualized}%/yr` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
