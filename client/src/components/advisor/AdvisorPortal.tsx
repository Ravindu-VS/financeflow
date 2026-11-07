import { useEffect, useState } from 'react'
import { apiClient, useAuthStore } from '../../store/enterpriseStore'

export default function AdvisorPortal() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [clientDetails, setClientDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const user = useAuthStore(state => state.user)

  useEffect(() => {
    fetchClients()
  }, [])

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

  if (!user?.is_advisor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-6xl">🔒</div>
        <h2 className="text-white text-xl font-bold">Financial Advisor Access Required</h2>
        <p className="text-gray-400 text-sm text-center max-w-md">
          This portal is only accessible to users with the <strong className="text-indigo-400">Financial Advisor</strong> role.
          Register as a Financial Advisor or contact your administrator.
        </p>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 max-w-sm w-full">
          <p className="text-xs text-gray-500 mb-2">To test Advisor role:</p>
          <p className="text-xs text-gray-400">Register a new account and select <strong>"Financial Advisor"</strong> as your role during signup.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/40 border border-indigo-500/20 rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl">👔</div>
          <div>
            <h1 className="text-white text-xl font-bold">Financial Advisor Portal</h1>
            <p className="text-indigo-300 text-sm">Advisor: {user?.first_name} {user?.last_name} · {clients.length} clients</p>
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
          <h2 className="text-white font-semibold">Your Clients</h2>
          {loading ? (
            <div className="text-center py-8"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" /></div>
          ) : clients.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
              <p className="text-4xl mb-2">👤</p>
              <p className="text-gray-400 text-sm">No clients assigned yet.</p>
              <p className="text-gray-600 text-xs mt-1">Clients can request an advisor from their profile.</p>
            </div>
          ) : (
            clients.map(client => (
              <button key={client.id} onClick={() => viewClient(client)}
                className={`w-full text-left bg-gray-900 border rounded-2xl p-4 transition-all duration-200 ${selectedClient?.id === client.id ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-gray-800 hover:border-gray-700'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
                    {client.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{client.name}</p>
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
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <p className="text-4xl mb-3">👈</p>
              <p className="text-white font-medium">Select a client to view details</p>
              <p className="text-gray-500 text-sm mt-1">View financial health, recommendations, and monthly summary</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6">
                <h3 className="text-white font-bold text-lg mb-4">{selectedClient.name}</h3>
                {clientDetails && (
                  <>
                    {/* Health Score */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {[
                        { label: 'Health Score', value: clientDetails.health_score?.score || 'N/A', icon: '❤️', sub: clientDetails.health_score?.grade },
                        { label: 'Monthly Income', value: `${selectedClient.currency} ${(clientDetails.monthly_summary?.income || 0).toLocaleString()}`, icon: '💰' },
                        { label: 'Savings Rate', value: `${clientDetails.monthly_summary?.savings_rate || 0}%`, icon: '📈' },
                      ].map(m => (
                        <div key={m.label} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
                          <span className="text-2xl">{m.icon}</span>
                          <p className="text-white font-bold text-xl mt-1">{m.value} {m.sub && <span className="text-sm text-gray-400">({m.sub})</span>}</p>
                          <p className="text-gray-500 text-xs">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Health Breakdown */}
                    {clientDetails.health_score?.breakdown && (
                      <div>
                        <p className="text-gray-400 text-sm font-medium mb-3">Health Score Breakdown</p>
                        <div className="space-y-2">
                          {Object.entries(clientDetails.health_score.breakdown).map(([key, val]: [string, any]) => (
                            <div key={key} className="flex items-center gap-3">
                              <p className="text-gray-500 text-xs w-32 capitalize">{key.replace(/_/g, ' ')}</p>
                              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${val.score >= 80 ? 'bg-green-500' : val.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${val.score}%` }} />
                              </div>
                              <p className="text-white text-xs font-bold w-8">{val.score}</p>
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
