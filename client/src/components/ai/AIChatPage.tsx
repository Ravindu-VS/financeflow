import { useState, useRef, useEffect } from 'react'
import { apiClient, useEnterpriseStore } from '../../store/enterpriseStore'
import { geminiDirect, GROUNDING_PROMPT } from '../../services/backend'
import { useFinanceStore } from '../../store/financeStore'
import { usePeriodData } from '../../hooks/useFinance'
import { buildFinancialContext, answerLocally } from '../../lib/finance'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  suggestions?: string[]
  insight_type?: string
  confidence?: number
  model?: string
  timestamp: Date
}

const QUICK_QUESTIONS = [
  "Why did I spend more this month?",
  "Where did most of my money go?",
  "How much did I save this month?",
  "How much can I safely spend?",
  "What changed compared with last month?",
  "What are my biggest unnecessary expenses?",
  "Show me my spending behavior.",
  "How much do I need to save for my goal?",
  "What do you predict for the rest of the month?"
]

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "👋 Hi! I'm **FinAI**, your AI-powered financial advisor.\n\nI answer from your actual recorded transactions and label every answer as **FACT**, **PREDICTION** or **SUGGESTION**. I can help with:\n- 📊 Spending analysis\n- 💰 Savings recommendations\n- 📈 Investment education\n- 🎯 Budget advice\n- 🔮 Financial predictions\n\nWhat would you like to know?",
      suggestions: QUICK_QUESTIONS.slice(0, 3),
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { healthScore, healthGrade } = useEnterpriseStore()
  const fin = useFinanceStore()
  const pd = usePeriodData()
  const getContext = () => buildFinancialContext({
    transactions: fin.transactions, rules: fin.rules, budgets: fin.budgets,
    goals: pd.goalProgress.map(g => ({ name: g.name, targetAmount: Number(g.targetAmount) || 0, currentAmount: Number(g.currentAmount) || 0, deadline: g.deadline })),
    safeToSpend: pd.safeToSpend, netWorth: pd.netWorth.netWorth,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    const updatedHistory = [...conversationHistory, { role: 'user', content: messageText }]

    const context = getContext()
    const push = (r: { response: string; suggestions?: string[]; insight_type?: string; confidence?: number; model?: string }) => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(), role: 'assistant', content: r.response,
        suggestions: r.suggestions?.length ? r.suggestions : QUICK_QUESTIONS.filter(q => q !== messageText).slice(0, 3),
        insight_type: r.insight_type || 'general', confidence: r.confidence, model: r.model, timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMsg])
      setConversationHistory([...updatedHistory, { role: 'assistant', content: r.response }])
    }
    try {
      if (!navigator.onLine) throw new Error('offline')
      // 1) Hosted Gemini through the API gateway → FastAPI backend (grounded on your real numbers)
      let reply: any = null
      try {
        const { data } = await apiClient.post('/api/v1/ai/chat', {
          message: messageText,
          conversation_history: updatedHistory.slice(-10),
          financial_context: context,
        }, { timeout: 30000 })
        if (data?.response && data.model_used !== 'unavailable') reply = { ...data, model: data.model_used }
      } catch { /* fall through */ }
      // 2) Your own key, straight to Gemini (optional)
      if (!reply && fin.settings.geminiApiKey) {
        reply = await geminiDirect(fin.settings.geminiApiKey, fin.settings.geminiModel || 'gemini-2.5-flash',
          GROUNDING_PROMPT + '\nUSER FINANCIAL DATA (JSON):\n' + JSON.stringify(context).slice(0, 24000), updatedHistory.slice(-10), messageText)
      }
      if (!reply) throw new Error('no-llm')
      push(reply)
    } catch {
      // 3) On-device answer from the same numbers
      push({ response: answerLocally(messageText, context), insight_type: 'spending_analysis', model: 'on-device' })
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const insightColors: Record<string, string> = {
    spending_analysis: 'from-orange-500 to-red-500',
    saving_recommendation: 'from-green-500 to-emerald-600',
    investment_education: 'from-blue-500 to-indigo-600',
    health_assessment: 'from-purple-500 to-violet-600',
    prediction: 'from-cyan-500 to-teal-600',
    general: 'from-gray-500 to-slate-600'
  }

  const insightIcons: Record<string, string> = {
    spending_analysis: '📊',
    saving_recommendation: '💰',
    investment_education: '📈',
    health_assessment: '❤️',
    prediction: '🔮',
    general: '🤖'
  }

  // Escape first: assistant/LLM output must never be able to inject HTML (XSS).
  const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const formatContent = (content: string) => {
    return escapeHtml(content)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
      .replace(/^(#{1,3})\s+(.+)$/gm, '<strong class="text-lg">$2</strong>')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)] bg-gray-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 border-b border-purple-500/30 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/30">
              🤖
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">FinAI Financial Advisor</h1>
              <p className="text-purple-300 text-sm">Powered by Google Gemini AI · RAG Pipeline · WSO2 Integrator BI</p>
            </div>
          </div>
          {healthScore !== null && (
            <div className="hidden md:flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/20">
              <div className="text-center">
                <div className="text-white font-bold text-2xl">{healthScore}</div>
                <div className="text-purple-300 text-xs">Health Score</div>
              </div>
              <div className={`text-2xl font-black px-3 py-1 rounded-xl ${
                (healthScore || 0) >= 80 ? 'text-green-400 bg-green-500/20' :
                (healthScore || 0) >= 60 ? 'text-yellow-400 bg-yellow-500/20' : 'text-red-400 bg-red-500/20'
              }`}>{healthGrade}</div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
              msg.role === 'user' 
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30' 
                : 'bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/30'
            }`}>
              {msg.role === 'user' ? '👤' : (insightIcons[msg.insight_type || ''] || '🤖')}
            </div>

            <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              {msg.insight_type && msg.role === 'assistant' && (
                <div className={`text-xs px-3 py-1 rounded-full bg-gradient-to-r ${insightColors[msg.insight_type] || insightColors.general} text-white font-medium inline-flex items-center gap-1`}>
                  {insightIcons[msg.insight_type]} {msg.insight_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  {msg.confidence ? <span className="opacity-75">· {Math.round(msg.confidence * 100)}% confidence</span> : null}{msg.model && <span className="opacity-75"> · {msg.model === "on-device" ? "on-device answer" : msg.model}</span>}
                </div>
              )}
              
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-sm shadow-lg shadow-blue-500/20'
                  : 'bg-gray-800 border border-gray-700/50 text-gray-100 rounded-tl-sm shadow-lg'
              }`}>
                <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
              </div>

              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {msg.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-xs bg-purple-900/50 border border-purple-500/30 text-purple-300 hover:text-white hover:bg-purple-800/60 px-3 py-1.5 rounded-full transition-all duration-200 hover:border-purple-400/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-600">
                {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-lg">🤖</div>
            <div className="bg-gray-800 border border-gray-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <span className="text-gray-400 text-sm mr-1">FinAI is thinking</span>
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 max-w-4xl mx-auto w-full">
          <p className="text-gray-500 text-xs mb-2">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 hover:border-purple-500/50 px-3 py-1.5 rounded-lg transition-all duration-200"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-gray-900 border-t border-gray-800 max-w-4xl mx-auto w-full">
        <div className="flex gap-2 bg-gray-800 border border-gray-700 rounded-2xl p-2 focus-within:border-purple-500/50 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask FinAI anything about your finances..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm px-2 outline-none"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 shadow-lg shadow-purple-500/20"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            Send
          </button>
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">
          🤖 AI responses are educational only. Always consult a licensed financial advisor for investment decisions.
        </p>
      </div>
    </div>
  )
}
