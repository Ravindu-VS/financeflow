import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { apiClient } from '../../store/enterpriseStore'
import { runSync } from '../../hooks/useBackendSync'
import { Card, SectionHeader } from '../ui'
import { getCategory } from '../../lib/finance'
import { formatCurrency } from '../../utils/currency'

interface Member { id: string; name: string; email: string; is_owner: boolean; is_you: boolean }
interface Group { id: string; name: string; currency: string; invite_code: string; is_owner: boolean }
interface Summary { month: string; income: number; expenses: number; net: number; savings_rate: number | null; members: { id: string; name: string; income: number; expenses: number; last_synced_at: string | null }[]; top_categories: { category: string; total: number }[] }

const errMsg = (e: any) => e?.response?.data?.detail || (e?.response ? 'Request failed' : 'The family service is unreachable — check your connection')

/** Household group: create, invite with a code, join, see combined monthly totals, leave. */
export default function FamilyAccounts() {
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [error, setError] = useState<string | null>(null)

  const apply = (d: any) => { setGroup(d?.group || null); setMembers(d?.members || []) }
  const load = async () => {
    try {
      setError(null)
      const { data } = await apiClient.get('/api/v1/family/members')
      apply(data)
      if (data?.group) loadSummary(month)
    } catch (e) { setError(errMsg(e)) } finally { setLoading(false) }
  }
  const loadSummary = async (m: string) => {
    try { const { data } = await apiClient.get('/api/v1/family/summary', { params: { month: m } }); setSummary(data) } catch { setSummary(null) }
  }
  useEffect(() => { runSync().catch(() => undefined).finally(load) }, [])

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true)
    try { const { data } = await fn(); apply(data); toast.success(ok); if (data?.group) loadSummary(month); else setSummary(null) }
    catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(group!.invite_code); toast.success('Invite code copied') } catch { toast.error('Copy failed — select the code and copy it') } }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 lg:pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">👨‍👩‍👧‍👦 Family Accounts</h1>
        <p className="text-sm text-gray-500 mt-1">Share a household view: combined income and spending, while each person keeps their own transactions private.</p>
      </div>

      {loading ? <Card><p className="text-sm text-gray-500">Loading your family group…</p></Card> : error ? (
        <Card><p className="text-sm text-red-600">{error}</p><button className="btn btn-secondary mt-3" onClick={() => { setLoading(true); load() }}>Try again</button></Card>
      ) : !group ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <SectionHeader title="Create a family group" subtitle="You'll get an invite code to share with your household" />
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (name.trim()) act(() => apiClient.post('/api/v1/family/create', { name: name.trim() }), 'Family group created') }}>
              <input className="input" placeholder="e.g. Perera Family" value={name} maxLength={100} onChange={e => setName(e.target.value)} />
              <button className="btn btn-primary w-full" disabled={busy || !name.trim()}>Create group</button>
            </form>
          </Card>
          <Card>
            <SectionHeader title="Join with an invite code" subtitle="Ask the group owner for their code" />
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (code.trim()) act(() => apiClient.post('/api/v1/family/join', { code: code.trim() }), 'Joined the family group') }}>
              <input className="input font-mono" placeholder="Paste invite code" value={code} onChange={e => setCode(e.target.value)} />
              <button className="btn btn-secondary w-full" disabled={busy || code.trim().length < 8}>Join group</button>
            </form>
          </Card>
        </div>
      ) : (
        <>
          <Card>
            <SectionHeader title={group.name} subtitle={`${members.length} member${members.length === 1 ? '' : 's'} · ${group.is_owner ? 'you are the owner' : 'member'}`}
              action={<button className="btn btn-secondary py-1.5 text-sm" disabled={busy} onClick={() => { if (confirm('Leave this family group?')) act(() => apiClient.post('/api/v1/family/leave'), 'You left the group') }}>Leave group</button>} />
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-gray-500">Invite code</span>
              <code className="font-mono text-sm break-all flex-1">{group.invite_code}</code>
              <button className="btn btn-primary py-1.5 text-sm" onClick={copy}>Copy</button>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {members.map(m => (
                <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full gradient-green text-white flex items-center justify-center font-semibold">{(m.name[0] || '?').toUpperCase()}</div>
                    <div className="min-w-0"><p className="font-medium text-gray-900 dark:text-white truncate">{m.name}{m.is_you ? ' (you)' : ''}</p><p className="text-xs text-gray-500 truncate">{m.email}</p></div>
                  </div>
                  {m.is_owner && <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">Owner</span>}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHeader title="Household this month" subtitle="Combined from each member's synced transactions"
              action={<input type="month" className="input py-1.5 w-auto" value={month} onChange={e => { setMonth(e.target.value); loadSummary(e.target.value) }} />} />
            {summary ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div><p className="text-xs text-gray-500">Income</p><p className="text-lg font-bold text-green-600 tabular-nums">{formatCurrency(summary.income)}</p></div>
                  <div><p className="text-xs text-gray-500">Expenses</p><p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(summary.expenses)}</p></div>
                  <div><p className="text-xs text-gray-500">Net</p><p className={`text-lg font-bold tabular-nums ${summary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(summary.net)}</p></div>
                  <div><p className="text-xs text-gray-500">Savings rate</p><p className="text-lg font-bold tabular-nums">{summary.savings_rate == null ? '—' : `${summary.savings_rate}%`}</p></div>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <p className="font-medium mb-1">By member</p>
                    {summary.members.map(p => (
                      <div key={p.id} className="flex justify-between text-sm py-1"><span>{p.name}</span><span className="tabular-nums text-gray-600 dark:text-gray-300">+{formatCurrency(p.income)} / −{formatCurrency(p.expenses)}</span></div>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium mb-1">Top shared categories</p>
                    {summary.top_categories.length ? summary.top_categories.map(c => (
                      <div key={c.category} className="flex justify-between text-sm py-1"><span>{getCategory(c.category).icon} {getCategory(c.category).label}</span><span className="tabular-nums">{formatCurrency(c.total)}</span></div>
                    )) : <p className="text-sm text-gray-500">No spending synced for this month yet.</p>}
                  </div>
                </div>
              </>
            ) : <p className="text-sm text-gray-500">No household totals yet — members' data appears after their app syncs.</p>}
          </Card>
        </>
      )}
    </div>
  )
}
