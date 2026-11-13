import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Card, SectionHeader } from '../ui'
import { useFinanceStore } from '../../store/financeStore'
import { settingsService } from '../../services/financeService'
import { CURRENCY_LIST, invertRates } from '../../lib/finance'

/**
 * Base currency + exchange rates. Rates are frozen into each foreign-currency transaction when it
 * is saved, so updating rates never changes past totals.
 */
export default function CurrencySettings() {
  const { settings, transactions } = useFinanceStore()
  const [base, setBase] = useState(settings.baseCurrency || 'LKR')
  const [rates, setRates] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setBase(settings.baseCurrency || 'LKR')
    setRates(Object.fromEntries(Object.entries(settings.fxRates || {}).map(([k, v]) => [k, String(v)])))
  }, [settings.baseCurrency, settings.fxRates])

  const codes = CURRENCY_LIST.map(c => c.code).filter(c => c !== base)
  const save = async () => {
    if (base !== (settings.baseCurrency || 'LKR') && transactions.length) {
      if (!confirm(`Change base currency to ${base}? Existing amounts recorded in ${settings.baseCurrency || 'LKR'} are NOT converted — only do this if you are starting fresh or the old base was wrong.`)) return
    }
    const clean: Record<string, number> = {}
    for (const [k, v] of Object.entries(rates)) { const n = parseFloat(v); if (k !== base && n > 0) clean[k] = n }
    try { await settingsService.save({ baseCurrency: base, fxRates: clean }); toast.success('Currency settings saved') } catch (e: any) { toast.error(e.message) }
  }
  const fetchRates = async () => {
    setBusy(true)
    try {
      // Free, keyless, CORS-enabled source (daily rates). Quotes 1 base = X foreign → inverted.
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`)
      const json = await res.json()
      if (json.result !== 'success') throw new Error('Rate service unavailable')
      const inv = invertRates(json.rates, codes)
      setRates(Object.fromEntries(Object.entries(inv).map(([k, v]) => [k, String(v)])))
      await settingsService.save({ baseCurrency: base, fxRates: inv, fxUpdatedAt: new Date().toISOString() })
      toast.success('Latest exchange rates saved')
    } catch (e: any) { toast.error(`Could not fetch rates: ${e.message}. Enter them manually.`) } finally { setBusy(false) }
  }

  return (
    <Card>
      <SectionHeader title="Currency" subtitle="All totals are shown in your base currency" />
      <div className="space-y-3 text-sm">
        <label className="block">Base currency
          <select className="input mt-1" value={base} onChange={e => setBase(e.target.value)}>
            {CURRENCY_LIST.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </select>
        </label>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span>Exchange rates (1 unit = ? {base})</span>
            <button disabled={busy} className="text-xs text-primary-600" onClick={fetchRates}>{busy ? 'Fetching…' : '↻ Get latest rates'}</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {codes.map(c => (
              <label key={c} className="flex items-center gap-1">
                <span className="w-10 text-gray-500">{c}</span>
                <input inputMode="decimal" className="input py-1.5" value={rates[c] ?? ''} placeholder="—" onChange={e => setRates({ ...rates, [c]: e.target.value })} />
              </label>
            ))}
          </div>
          {settings.fxUpdatedAt && <p className="text-xs text-gray-400 mt-1">Rates updated {new Date(settings.fxUpdatedAt).toLocaleString()}</p>}
          <p className="text-xs text-gray-400 mt-1">Each foreign-currency entry keeps the rate used when it was saved, so past totals never change.</p>
        </div>
        <button className="btn btn-primary" onClick={save}>Save currency settings</button>
      </div>
    </Card>
  )
}
