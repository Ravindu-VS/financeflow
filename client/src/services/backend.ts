/**
 * Connection to the hosted services: API gateway (WSO2-pattern, Node) → FastAPI AI backend → PostgreSQL.
 * Every request is authenticated with the signed-in user's Firebase ID token; the gateway and
 * the backend both verify it against Google's public keys. No service is required for the app
 * to work: Firestore stays the system of record and every feature has an on-device fallback.
 */
import axios from 'axios'
import { auth } from '../config/firebase'
import type { Transaction } from '../lib/finance'

const PROD_GATEWAY = 'https://financeflow-gateway.vercel.app'

export function gatewayUrl(): string {
  try {
    const override = localStorage.getItem('ff_gateway_url')
    if (override) return override.replace(/\/+$/, '')
  } catch { /* storage unavailable */ }
  const env = import.meta.env.VITE_GATEWAY_URL
  if (env) return env.replace(/\/+$/, '')
  if (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return 'http://localhost:8080'
  return PROD_GATEWAY
}

export async function idToken(forceRefresh = false): Promise<string | null> {
  try { return (await auth.currentUser?.getIdToken(forceRefresh)) || null } catch { return null }
}

export const backend = axios.create({ timeout: 20000 })
backend.interceptors.request.use(async config => {
  config.baseURL = gatewayUrl()
  const t = await idToken()
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

export interface ServiceStatus { name: string; status: 'online' | 'degraded' | 'offline' | 'not_configured'; detail?: string; latencyMs?: number }

/** Live status of every hosted service, via the gateway's aggregated health endpoint. */
export async function serviceStatus(): Promise<ServiceStatus[]> {
  const t0 = performance.now()
  try {
    const { data } = await axios.get(`${gatewayUrl()}/gateway/health`, { timeout: 12000 })
    const ms = Math.round(performance.now() - t0)
    const st = (v: string | undefined): ServiceStatus['status'] =>
      v === 'online' || v === 'ok' || v === 'healthy' ? 'online' : v === 'not_configured' ? 'not_configured' : v === 'unknown' || !v ? 'offline' : v === 'offline' ? 'offline' : 'degraded'
    return [
      { name: 'API Gateway', status: 'online', detail: `v${data?.gateway?.version || '1'} · token validation, rate limiting, analytics`, latencyMs: ms },
      { name: 'AI Backend (FastAPI)', status: st(data?.ai_backend?.status), detail: data?.ai_backend?.error || (data?.ai_backend?.latency_ms != null ? `${data.ai_backend.latency_ms} ms` : undefined) },
      { name: 'PostgreSQL (Supabase)', status: st(data?.database?.status), detail: data?.database?.latency_ms != null ? `query ${data.database.latency_ms} ms` : data?.database?.error },
      { name: 'Gemini LLM', status: st(data?.llm?.status), detail: data?.llm?.error || data?.llm?.model },
      { name: 'Authentication (Firebase)', status: st(data?.auth?.status), detail: data?.auth?.project },
      { name: 'Firestore (system of record)', status: navigator.onLine ? 'online' : 'degraded', detail: navigator.onLine ? 'Realtime sync' : 'Offline — changes are queued' },
    ]
  } catch (e: any) {
    return [
      { name: 'API Gateway', status: 'offline', detail: e?.message || 'unreachable' },
      { name: 'Firestore (system of record)', status: navigator.onLine ? 'online' : 'degraded', detail: 'The app keeps working on-device' },
    ]
  }
}

// ── Firestore → PostgreSQL sync ────────────────────────────────────────────

const SYNC_KEY = 'ff_last_sync'
export function lastSync(): string | null { try { return localStorage.getItem(SYNC_KEY) } catch { return null } }

export function syncPayload(txs: Transaction[], goals: any[], holdings: any[], since: string, until: string) {
  const dateKey = (v: any): string | null => {
    if (!v) return null
    if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null
    const d = v.toDate ? v.toDate() : typeof v.seconds === 'number' ? new Date(v.seconds * 1000) : v instanceof Date ? v : null
    return d ? d.toISOString().slice(0, 10) : null
  }
  return {
    since, until,
    transactions: txs.filter(t => t.date >= since && t.date <= until).map(t => ({
      id: t.id, type: t.type, amount: t.originalAmount ?? t.amount, currency: t.currency || 'LKR',
      baseAmount: t.amount, date: t.date, category: t.category, subcategory: t.subcategory,
      description: t.description?.slice(0, 500), merchant: t.merchant?.slice(0, 200), paymentMethod: t.paymentMethod,
      tags: t.tags, kind: t.kind, status: t.status, source: t.source, recurrenceId: t.recurrenceId,
    })),
    goals: goals.map(g => ({ id: g.id, name: String(g.name || 'Goal').slice(0, 200), targetAmount: Number(g.targetAmount) || 0, currentAmount: Number(g.currentAmount) || 0, targetDate: dateKey(g.targetDate), status: g.status || 'active' })),
    holdings: holdings.map(h => ({ id: h.id, name: String(h.name || 'Holding').slice(0, 200), type: String(h.type || 'other'), amount: Number(h.amount) || 0, currentValue: Number(h.currentValue) || undefined, purchaseDate: dateKey(h.purchaseDate), status: h.status || 'active' })),
  }
}

export async function syncToBackend(txs: Transaction[], goals: any[], holdings: any[], since: string, until: string) {
  if (!auth.currentUser) throw new Error('Not signed in')
  const { data } = await backend.post('/api/v1/sync/firestore', syncPayload(txs, goals, holdings, since, until), { timeout: 45000 })
  try { localStorage.setItem(SYNC_KEY, new Date().toISOString()) } catch { /* ignore */ }
  return data as { transactions: { upserted: number; deleted: number }; goals: number; holdings: number }
}

// ── LLM ─────────────────────────────────────────────────────────────────────

export interface AiReply { response: string; suggestions?: string[]; insight_type?: string; confidence?: number; model?: string }

/** Optional bring-your-own-key: call Gemini straight from the browser when the backend is unreachable. */
export async function geminiDirect(apiKey: string, model: string, system: string, history: { role: string; content: string }[], message: string): Promise<AiReply> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-2.5-flash')}:generateContent`
  const contents = [...history.slice(-8), { role: 'user', content: message }].map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  const { data } = await axios.post(url, { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 1024 } }, { headers: { 'x-goog-api-key': apiKey }, timeout: 30000 })
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
  if (!text) throw new Error('Empty response')
  return { response: text, model: `${model} (direct)` }
}

export const GROUNDING_PROMPT = `You are FinAI, a personal finance assistant for a user in Sri Lanka (currency LKR unless stated).
Answer ONLY from the JSON financial data provided. Never invent numbers. If the data does not contain the answer, say so.
Label each statement as FACT (recorded data), PREDICTION (estimate) or RECOMMENDATION. Be concise and practical.
Investment content is educational, not financial advice.`
