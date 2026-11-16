import { useState } from 'react'
import { useSpeech } from '../../hooks/useSpeech'
import { apiClient } from '../../store/enterpriseStore'
import { auth } from '../../config/firebase'
import toast from 'react-hot-toast'
import { parseAnyLanguage, isSinhala, sinhalaToEnglish, makePeriod, summarize, categoryLabel, todayKey, type ParsedEntry } from '../../lib/finance'
import { useQuickAdd } from '../../store/quickAddStore'
import { useFinanceStore } from '../../store/financeStore'
import { formatCurrency } from '../../utils/currency'

const TYPE_TO_INTENT: Record<string, string> = {
  expense: 'add_expense', income: 'add_income', investment: 'add_investment', savings_contribution: 'add_savings',
  transfer: 'add_transfer', refund: 'add_refund', reimbursement: 'add_refund',
}

/** Answer simple questions on-device from the user's real data. */
function answerQuery(text: string): string | null {
  const t = (isSinhala(text) ? sinhalaToEnglish(text) : text).toLowerCase()
  if (!/^(how much|what|did i|show)/.test(t)) return null
  const { transactions } = useFinanceStore.getState()
  const p = /today/.test(t) ? makePeriod('today') : /week/.test(t) ? makePeriod('this_week') : /last month/.test(t) ? makePeriod('last_month') : /year/.test(t) ? makePeriod('this_year') : makePeriod('this_month')
  const s = summarize(transactions.filter(x => x.date >= p.start && x.date <= p.end))
  if (/sav/.test(t)) return `FACT · ${p.label}: you saved ${formatCurrency(s.savings)} and invested ${formatCurrency(s.investments)}.`
  if (/earn|income|receiv/.test(t)) return `FACT · ${p.label}: income ${formatCurrency(s.income)}.`
  if (/spen|expense/.test(t)) return `FACT · ${p.label}: you spent ${formatCurrency(s.netExpenses)} across ${s.count} transactions.`
  return `FACT · ${p.label}: income ${formatCurrency(s.income)}, expenses ${formatCurrency(s.netExpenses)}, net ${formatCurrency(s.netCashFlow)}.`
}

function toResult(p: ParsedEntry, raw: string): VoiceResult {
  return {
    intent: p.type ? (TYPE_TO_INTENT[p.type] || 'add_expense') : 'unknown',
    confidence: p.confidence,
    entities: { amount: p.amount, category: p.category ? categoryLabel(p.category) : null, date: p.date, description: p.description, unexpected: p.isUnexpected ? 'yes' : null },
    suggested_action: p.type && p.amount ? `Review a ${p.type.replace('_', ' ')} of ${formatCurrency(p.amount)}${p.category ? ` in ${categoryLabel(p.category)}` : ''} dated ${p.date}` : 'Could not understand an amount and type — try e.g. "Spent 500 on lunch"',
    form_data: p.type && p.amount ? { type: p.type, amount: p.amount, category: p.category, subcategory: p.subcategory, description: p.description, date: p.date, kind: p.isUnexpected ? 'unexpected' : undefined } : {},
    raw_transcript: raw,
  }
}

interface VoiceResult {
  intent: string
  confidence: number
  entities: Record<string, any>
  suggested_action: string
  form_data: Record<string, any>
  raw_transcript: string
}

const EXAMPLE_COMMANDS = [
  { text: "Spent 500 on lunch", intent: "add_expense" },
  { text: "Paid 3,500 for vehicle repair today", intent: "add_expense" },
  { text: "Received 15,000 from freelance work", intent: "add_income" },
  { text: "Add salary income 75000", intent: "add_income" },
  { text: "Invested 20,000 in a fixed deposit", intent: "add_investment" },
  { text: "How much did I spend this week?", intent: "query_balance" },
  { text: "Save 5000 to emergency fund", intent: "add_savings" },
]
const EXAMPLE_COMMANDS_SI = [
  { text: 'අද දවල් කෑමට රුපියල් 850ක් වියදම් කළා', intent: 'add_expense' },
  { text: 'ඊයේ ත්‍රීවීල් එකට 600ක් ගෙව්වා', intent: 'add_expense' },
  { text: 'විදුලි බිලට දෙදාහයි පන්සියයි ගෙව්වා', intent: 'add_expense' },
  { text: 'පඩිය රුපියල් ලක්ෂ දෙකයි පනස්දාහක් ලැබුණා', intent: 'add_income' },
  { text: 'රත්තරන් වලට 20000ක් ආයෝජනය කළා', intent: 'add_investment' },
  { text: '5000ක් ඉතුරු කළා', intent: 'add_savings' },
  { text: 'මේ මාසේ කීයද වියදම් කළේ', intent: 'query_balance' },
]

export default function VoiceAssistant({ onFormFill: onFormFillProp }: { onFormFill?: (intent: string, data: any) => void }) {
  const quick = useQuickAdd()
  const [answer, setAnswer] = useState<string | null>(null)
  // Voice never saves directly: it pre-fills the normal transaction form for confirmation.
  const onFormFill = onFormFillProp || ((intent: string, data: any) => {
    const { type, ...rest } = data
    const fromIntent: Record<string, any> = { add_expense: 'expense', add_income: 'income', add_investment: 'investment', add_savings: 'savings_contribution', add_transfer: 'transfer', add_refund: 'refund' }
    quick.open(type || fromIntent[intent] || 'expense', { ...rest, amount: rest.amount != null ? Number(rest.amount) : undefined, source: 'voice' })
  })
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<VoiceResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [history, setHistory] = useState<VoiceResult[]>([])
  const [manualInput, setManualInput] = useState('')
  const speech = useSpeech(text => { setTranscript(text); processTranscript(text) })
  const isListening = speech.listening
  const supported = speech.supported
  const si = speech.lang === 'si-LK'

  const processTranscript = async (text: string) => {
    if (!text.trim()) return
    setIsProcessing(true)
    setAnswer(null)
    try {
      const q = answerQuery(text)
      if (q) { setAnswer(q); setResult(null); return }
      // 1) On-device parser (works offline, no backend needed)
      let data = toResult(parseAnyLanguage(text, todayKey()), text)
      // 2) Optional: enterprise NLP backend when signed in to the gateway and local confidence is low
      if (data.confidence < 0.6 && !isSinhala(text) && auth.currentUser && navigator.onLine) {
        try {
          const { data: remote } = await apiClient.post('/api/v1/voice/process', { transcript: text }, { timeout: 4000 })
          if (remote?.confidence > data.confidence) data = remote
        } catch { /* backend unavailable — keep local result */ }
      }
      setResult(data)
      setHistory(prev => [data, ...prev].slice(0, 10))
      if (data.confidence > 0.5 && data.form_data && Object.keys(data.form_data).length) {
        toast.success(`Detected: ${data.intent.replace('_', ' ')} · ${Math.round(data.confidence * 100)}% confidence`)
      }
    } catch (err) {
      toast.error('Failed to process voice command')
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleListening = () => {
    if (isListening) speech.stop()
    else { setTranscript(''); setResult(null); setAnswer(null); speech.start() }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) {
      setTranscript(manualInput)
      processTranscript(manualInput)
      setManualInput('')
    }
  }

  const intentColors: Record<string, string> = {
    add_expense: 'text-red-400 bg-red-500/10 border-red-500/30',
    add_income: 'text-green-400 bg-green-500/10 border-green-500/30',
    add_investment: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    add_savings: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    query_balance: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    query_budget: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    query_savings: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    unknown: 'text-gray-400 bg-gray-500/10 border-gray-500/30'
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5">
          <span className="text-indigo-400 text-sm font-medium">🎙️ Voice Financial Assistant</span>
          <span className="text-xs text-gray-500">Web Speech API + NLP</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Talk to FinAI</h2>
        <p className="text-gray-400 text-sm">Speak naturally in English or සිංහල to add transactions or ask about your money</p>
      </div>

      {/* Language */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1" role="radiogroup" aria-label="Voice language">
          {([['en-LK', 'English'], ['si-LK', 'සිංහල']] as const).map(([code, label]) => (
            <button key={code} type="button" role="radio" aria-checked={speech.lang === code} disabled={isListening} onClick={() => speech.setLang(code)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium ${speech.lang === code ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Microphone Button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={toggleListening}
          disabled={!supported || isProcessing}
          className={`relative w-28 h-28 rounded-full flex items-center justify-center text-4xl transition-all duration-300 ${
            isListening
              ? 'bg-red-500 shadow-2xl shadow-red-500/50 scale-110'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:scale-105 shadow-2xl shadow-indigo-500/30'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isListening && (
            <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
          )}
          {isProcessing ? (
            <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span>{isListening ? '⏹️' : '🎤'}</span>
          )}
        </button>

        <div className="text-center">
          {isListening && (
            <div className="flex items-center gap-2 text-red-400">
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-1 bg-red-400 rounded-full animate-pulse"
                    style={{ height: `${Math.random() * 20 + 8}px`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
              <span className="text-sm font-medium">{si ? 'අහගෙන ඉන්නවා… ' : 'Listening… '}{speech.interim && <em className="font-normal">"{speech.interim}"</em>}</span>
            </div>
          )}
          {isProcessing && <p className="text-indigo-400 text-sm animate-pulse">Processing command...</p>}
          {!isListening && !isProcessing && <p className="text-gray-500 text-sm">{si ? 'කතා කිරීමට ඔබන්න' : 'Tap to speak'}</p>}
          {speech.error && <p className="text-red-600 dark:text-red-400 text-sm mt-2 max-w-sm">{speech.error}</p>}
        </div>
      </div>

      {/* Live Transcript */}
      {transcript && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Transcript</p>
          <p className="text-gray-900 dark:text-white">"<em>{transcript}</em>"</p>
        </div>
      )}

      {answer && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-gray-900 dark:text-white text-sm">{answer}</div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${intentColors[result.intent] || intentColors.unknown}`}>
              {result.intent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            <span className="text-xs text-gray-500">{Math.round(result.confidence * 100)}% confidence</span>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Suggested Action</p>
            <p className="text-gray-900 dark:text-white text-sm">{result.suggested_action}</p>
          </div>

          {Object.keys(result.entities).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Extracted Information</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(result.entities).filter(([_, v]) => v).map(([key, value]) => (
                  <div key={key} className="bg-gray-100 dark:bg-gray-900/50 rounded-xl px-3 py-2">
                    <p className="text-xs text-gray-500 capitalize">{key.replace('_', ' ')}</p>
                    <p className="text-gray-900 dark:text-white text-sm font-medium">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.form_data && Object.keys(result.form_data).length > 0 && onFormFill && (
            <button
              onClick={() => onFormFill(result.intent, result.form_data)}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-lg shadow-indigo-500/20"
            >
              ✅ Review & save
            </button>
          )}
        </div>
      )}

      {/* Manual Text Input (fallback) */}
      <form onSubmit={handleManualSubmit} className="space-y-2">
        <p className="text-xs text-gray-500 text-center">Or type a command manually:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={si ? 'උදා: අද කෑමට 500ක් වියදම් කළා' : 'e.g. Add expense 500 for lunch'}
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500/50 placeholder-gray-600 transition-colors"
          />
          <button
            type="submit"
            disabled={!manualInput.trim() || isProcessing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Process
          </button>
        </div>
      </form>

      {/* Example Commands */}
      <div>
        <p className="text-xs text-gray-500 mb-3">Example commands:</p>
        <div className="space-y-2">
          {(si ? EXAMPLE_COMMANDS_SI : EXAMPLE_COMMANDS).map((cmd, i) => (
            <button
              key={i}
              onClick={() => { setManualInput(cmd.text); processTranscript(cmd.text) }}
              className="w-full text-left bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 hover:border-indigo-500/30 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 flex items-center gap-3"
            >
              <span className={`text-xs px-2 py-0.5 rounded-full border ${intentColors[cmd.intent] || ''}`}>
                {cmd.intent.replace(/_/g, ' ')}
              </span>
              <span>"{cmd.text}"</span>
            </button>
          ))}
        </div>
      </div>

      {!supported && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-400 text-sm">
          ⚠️ Speech recognition isn't available in this browser. Use Chrome (Android/desktop), Edge or Safari — or type above (English or සිංහල).
        </div>
      )}
    </div>
  )
}
