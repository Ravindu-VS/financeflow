import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Card, SectionHeader } from '../ui'
import { serviceStatus, gatewayUrl, type ServiceStatus } from '../../services/backend'
import { useSyncStatus, runSync } from '../../hooks/useBackendSync'
import { useFinanceStore } from '../../store/financeStore'
import { settingsService } from '../../services/financeService'

const DOT: Record<ServiceStatus['status'], string> = { online: 'bg-green-500', degraded: 'bg-amber-500', offline: 'bg-red-500', not_configured: 'bg-gray-400' }
const LABEL: Record<ServiceStatus['status'], string> = { online: 'Online', degraded: 'Degraded', offline: 'Offline', not_configured: 'Not configured' }

/** Live status of the hosted services, Firestore→PostgreSQL sync, AI and notification settings. */
export default function ServicesPanel() {
  const [list, setList] = useState<ServiceStatus[] | null>(null)
  const [checking, setChecking] = useState(false)
  const sync = useSyncStatus()
  const settings = useFinanceStore(s => s.settings)
  const [key, setKey] = useState('')
  const [model, setModel] = useState(settings.geminiModel || 'gemini-2.5-flash')

  const check = async () => { setChecking(true); setList(await serviceStatus()); setChecking(false) }
  useEffect(() => { check() }, [])

  const syncNow = async () => {
    try { await runSync(); toast.success('Synced to PostgreSQL') } catch (e: any) { toast.error(useSyncStatus.getState().error || e.message) }
  }
  const saveAi = async () => {
    await settingsService.save({ ...(key ? { geminiApiKey: key.trim() } : {}), geminiModel: model })
    setKey(''); toast.success('AI settings saved')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <SectionHeader title="Service status" subtitle={<span className="break-all">Gateway: {gatewayUrl()}</span>} action={<button className="btn btn-secondary py-1.5 text-sm" onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Refresh'}</button>} />
        <ul className="space-y-2" data-testid="service-status">
          {(list || []).map(s => (
            <li key={s.name} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                {s.detail && <p className="text-xs text-gray-500 truncate">{s.detail}{s.latencyMs != null ? ` · ${s.latencyMs} ms` : ''}</p>}
              </div>
              <span className="flex items-center gap-1.5 text-sm whitespace-nowrap"><span className={`w-2.5 h-2.5 rounded-full ${DOT[s.status]}`} />{LABEL[s.status]}</span>
            </li>
          ))}
          {!list && <li className="text-sm text-gray-500">Checking services…</li>}
        </ul>
        <p className="text-xs text-gray-500 mt-3">Your data lives in Firestore and works offline. The gateway, AI backend and PostgreSQL add server-side AI, reports and analytics.</p>
      </Card>

      <Card>
        <SectionHeader title="Sync to PostgreSQL" subtitle="Automatic after changes; runs again when you reconnect" />
        <div className="space-y-2 text-sm">
          <p>Last sync: <b>{sync.last ? new Date(sync.last).toLocaleString() : 'never'}</b>{sync.counts ? ` · ${sync.counts.upserted} updated, ${sync.counts.deleted} removed` : ''}</p>
          {sync.error && <p className="text-red-600">Last error: {sync.error}</p>}
          <button className="btn btn-primary" onClick={syncNow} disabled={sync.syncing}>{sync.syncing ? 'Syncing…' : '🔄 Sync now'}</button>
        </div>

        <div className="mt-6">
          <SectionHeader title="AI assistant" subtitle="Server-side Gemini is used by default" />
          <div className="space-y-2 text-sm">
            <label className="block">Model
              <select className="input mt-1" value={model} onChange={e => setModel(e.target.value)}>
                <option value="gemini-2.5-flash">gemini-2.5-flash (fast)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (deeper)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              </select></label>
            <label className="block">Your own Gemini API key (optional fallback)
              <input type="password" autoComplete="off" className="input mt-1" placeholder={settings.geminiApiKey ? '•••••••• saved' : 'AIza…'} value={key} onChange={e => setKey(e.target.value)} /></label>
            <p className="text-xs text-gray-500">Only used if the hosted AI is unreachable. Stored in your private Firestore settings.</p>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={saveAi}>Save</button>
              {settings.geminiApiKey && <button className="btn btn-secondary" onClick={() => settingsService.save({ geminiApiKey: '' }).then(() => toast.success('Key removed'))}>Remove key</button>}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export function DeviceNotificationsCard() {
  const settings = useFinanceStore(s => s.settings)
  const supported = typeof Notification !== 'undefined'
  const toggle = async (on: boolean) => {
    if (on && supported) {
      const p = await Notification.requestPermission()
      if (p !== 'granted') return toast.error('Notifications are blocked in your browser settings')
    }
    await settingsService.save({ notificationsEnabled: on })
    toast.success(on ? 'Device notifications on' : 'Device notifications off')
  }
  return (
    <Card>
      <SectionHeader title="Device notifications" subtitle="Bills due, budget limits, goal deadlines, unusual expenses, low safe-to-spend" />
      <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Show notifications on this device</p>
          <p className="text-sm text-gray-500">{supported ? `Browser permission: ${Notification.permission}` : 'Not supported by this browser — alerts still appear under the bell'}</p>
        </div>
        <input type="checkbox" className="w-5 h-5" disabled={!supported} checked={!!settings.notificationsEnabled} onChange={e => toggle(e.target.checked)} />
      </label>
    </Card>
  )
}
