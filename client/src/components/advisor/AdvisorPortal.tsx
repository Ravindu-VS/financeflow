import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { apiClient } from '../../store/enterpriseStore'
import { runSync } from '../../hooks/useBackendSync'

const errMsg = (e: any) => e?.response?.data?.detail || (e?.response ? 'Request failed' : 'The advisor service is unreachable — check your connection')

/** Client side: share (or stop sharing) your synced data with an advisor using their code. */
function ShareWithAdvisor({ status, onChange }: { status: any; onChange: (s: any) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const call = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true)
    try { const { data } = await fn(); onChange(data); toast.success(ok); setCode('') } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 w-full max-w-md space-y-3">
      <p className="font-semibold text-gray-900 dark:text-white">Share with your financial advisor</p>
      {status?.my_advisor ? (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-300">Your summary is shared with <b>{status.my_advisor.name}</b> ({status.my_advisor.email}). They can see totals, budgets and your health score — not your login.</p>
          <button className="btn btn-secondary w-full" disabled={busy} onClick={() => call(() => apiClient.post('/api/v1/advisor/unlink'), 'Stopped sharing')}>Stop sharing</button>
        </>
      ) : (
        <form className="space-y-2" onSubmit={e => { e.preventDefault(); call(async () => { await runSync().catch(() => undefined); return apiClient.post('/api/v1/advisor/link', { code: code.trim() }) }, 'Shared with your advisor') }}>
          <p className="text-sm text-gray-600 dark:text-gray-300">Enter the advisor code your advisor gave you. You can stop sharing at any time.</p>
          <input className="input font-mono" placeholder="Advisor code" value={code} onChange={e => setCode(e.target.value)} />
          <button className="btn btn-primary w-full" disabled={busy || code.trim().length < 8}>Share my summary</button>
        </form>
      )}
    </div>
  )
}

export default function AdvisorPortal() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [clientDetails, setClientDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ is_advisor: boolean; roles: string[]; first_name?: string; last_name?: string } | null>(null)
  const [checked, setChecked] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)

  const load = () => {
    setError(null)
    Promise.all([apiClient.get('/api/v1/auth/me'), apiClient.get('/api/v1/advisor/me')])
      .then(([me, st]) => { setUser(me.data); setStatus(st.data); if (me.data?.is_advisor) fetchClients(); else setLoading(false) })
      .catch(e => { setError(errMsg(e)); setLoading(false) }).finally(() => setChecked(true))
  }
  useEffect(load, [])

  const enroll = async () => {
    setEnrolling(true)
    try { await apiClient.post('/api/v1/advisor/enroll'); toast.success('Advisor mode is on'); setLoading(true); load() }
    catch (e) { toast.error(errMsg(e)) } finally { setEnrolling(false) }
  }
  const copyCode = async () => { try { await navigator.clipboard.writeText(status?.advisor_code || ''); toast.success('Advisor code copied') } catch { toast.error('Copy failed') } }

  const fetchClients = async () => {
    try {
      const { data } = await apiClient.get('/api/v1/advisor/clients')
      setClients(data.clients || [])
    } catch (e) {
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  const viewClient = async (client: any) => {
    setSelectedClient(client)
    try {
      const { data } = await apiClient.get(`/api/v1/advisor/clients/${client.id}/overview`)
      setClientDetails(data)
    } catch (e) { console.error(e) }
  }

  if (!checked) return <div className="min-h-[400px] flex items-center justify-center text-gray-600 dark:text-gray-400">Checking access…</div>
  if (error) return (
    <div className="min-h-[300px] flex flex-col items-center justify-center gap-3">
      <p className="text-red-600 text-sm">{error}</p><button className="btn btn-secondary" onClick={() => { setChecked(false); load() }}>Try again</button>
    </div>
  )
  if (!user?.is_advisor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-5 pb-24">
        <div className="text-6xl">👔</div>
        <h2 className="text-gray-900 dark:text-white text-xl font-bold">Financial Advisor Portal</h2>
        <p className="text-gray-500 text-sm text-center max-w-md">
          Advisors see a summary of the clients who choose to share with them — totals, budgets and health scores.
          Clients share by entering the advisor's code and can stop at any time.
        </p>
        <ShareWithAdvisor status={status} onChange={setStatus} />
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 w-full max-w-md space-y-2">
          <p className="font-semibold text-gray-900 dark:text-white">Are you a financial advisor?</p>
          <p className="text-sm text-gray-500">Turn on advisor mode to get your advisor code and see clients who share with you.</p>
          <button className="btn btn-primary w-full" disabled={enrolling} onClick={enroll}>{enrolling ? 'Turning on…' : 'Turn on advisor mode'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 border border-indigo-500/20 rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl">👔</div>
          <div>
            <h1 className="text-white text-xl font-bold">Financial Advisor Portal</h1>
            <p className="text-indigo-300 text-sm">Advisor: {user?.first_name} {user?.last_name} · {clients.length} clients</p>
            <p className="text-indigo-200 text-xs mt-1">Your advisor code: <code className="font-mono">{status?.advisor_code}</code> <button className="underline ml-1" onClick={copyCode}>Copy</button> — give it to clients so they can share with you.</p>
          </div>
        </div>
        <div className="flex gap-6 mt-4">
          {[
            { label: 'Total Clients', value: clients.length },
            { label: 'High Risk', value: clients.filter(c => (c.health_score || 0) < 50).length },
            { label: 'Excellent Health', value: clients.filter(c => (c.health_score || 0) >= 80).length },
          ].map(m => (
            <div key={m.label}>
              <p className="text-2xl font-bold text-white">{m.value}</p>
              <p className="text-indigo-300/70 text-xs">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-gray-900 dark:text-white font-semibold">Your Clients</h2>
          {loading ? (
            <div className="text-center py-8"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" /></div>
          ) : clients.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center">
              <p className="text-4xl mb-2">👤</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">No clients yet — share your advisor code above with clients.</p>
              <p className="text-gray-600 text-xs mt-1">Clients can request an advisor from their profile.</p>
            </div>
          ) : (
            clients.map(client => (
              <button key={client.id} onClick={() => viewClient(client)}
                className={`w-full text-left bg-white dark:bg-gray-900 border rounded-2xl p-4 transition-all duration-200 ${selectedClient?.id === client.id ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
                    {client.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{client.name}</p>
                    <p className="text-gray-500 text-xs truncate">{client.email}</p>
                  </div>
                  {client.health_score !== null && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                      client.health_score >= 80 ? 'bg-green-500/10 text-green-400' :
                      client.health_score >= 60 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                    }`}>{client.health_score}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Client Details */}
        <div className="lg:col-span-2">
          {!selectedClient ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <p className="text-4xl mb-3">👈</p>
              <p className="text-gray-900 dark:text-white font-medium">Select a client to view details</p>
              <p className="text-gray-500 text-sm mt-1">View financial health, recommendations, and monthly summary</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6">
                <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-4">{selectedClient.name}</h3>
                {clientDetails && (
                  <>
                    {/* Health Score */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {[
                        { label: 'Health Score', value: clientDetails.health_score?.score || 'N/A', icon: '❤️', sub: clientDetails.health_score?.grade },
                        { label: 'Monthly Income', value: `${selectedClient.currency} ${(clientDetails.monthly_summary?.income || 0).toLocaleString()}`, icon: '💰' },
                        { label: 'Savings Rate', value: `${clientDetails.monthly_summary?.savings_rate || 0}%`, icon: '📈' },
                      ].map(m => (
                        <div key={m.label} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-2xl p-4">
                          <span className="text-2xl">{m.icon}</span>
                          <p className="text-gray-900 dark:text-white font-bold text-xl mt-1">{m.value} {m.sub && <span className="text-sm text-gray-600 dark:text-gray-400">({m.sub})</span>}</p>
                          <p className="text-gray-500 text-xs">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Health Breakdown */}
                    {clientDetails.health_score?.breakdown && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-3">Health Score Breakdown</p>
                        <div className="space-y-2">
                          {Object.entries(clientDetails.health_score.breakdown).map(([key, val]: [string, any]) => (
                            <div key={key} className="flex items-center gap-3">
                              <p className="text-gray-500 text-xs w-32 capitalize">{key.replace(/_/g, ' ')}</p>
                              <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${val.score >= 80 ? 'bg-green-500' : val.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${val.score}%` }} />
                              </div>
                              <p className="text-gray-900 dark:text-white text-xs font-bold w-8">{val.score}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
