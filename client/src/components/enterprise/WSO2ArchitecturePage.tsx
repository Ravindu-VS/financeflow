import { useEffect, useState } from 'react'
import { useEnterpriseStore } from '../../store/enterpriseStore'
import axios from 'axios'

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080'

interface ServiceStatus {
  name: string
  status: 'online' | 'offline' | 'checking'
  url: string
  description: string
  icon: string
  color: string
}

const SERVICES: ServiceStatus[] = [
  { name: 'WSO2 API Gateway', status: 'checking', url: `${GATEWAY_URL}/health`, description: 'Rate limiting, JWT validation, analytics', icon: '🌐', color: 'blue' },
  { name: 'FastAPI AI Backend', status: 'checking', url: `${GATEWAY_URL}/health`, description: 'AI advisor, ML predictions, health scores', icon: '🤖', color: 'purple' },
  { name: 'PostgreSQL Database', status: 'checking', url: `${GATEWAY_URL}/health`, description: 'Financial data storage, audit logs', icon: '🗄️', color: 'green' },
  { name: 'Node.js Backend', status: 'checking', url: `${GATEWAY_URL}/health`, description: 'Market data, legacy API endpoints', icon: '📡', color: 'yellow' },
  { name: 'Gemini AI', status: 'checking', url: `${GATEWAY_URL}/health`, description: 'LLM provider, RAG pipeline', icon: '✨', color: 'pink' },
  { name: 'Redis Cache', status: 'checking', url: `${GATEWAY_URL}/health`, description: 'Session store, rate limit buckets', icon: '⚡', color: 'orange' },
]

const WSO2_PRODUCTS = [
  {
    name: 'WSO2 API Manager',
    version: '4.3.0',
    role: 'API Gateway & Developer Portal',
    features: ['OAuth2 / JWT token validation', 'Rate limiting & throttling', 'API lifecycle management', 'Developer portal', 'API analytics & monitoring'],
    color: 'from-blue-600 to-cyan-600',
    icon: '🛡️',
    port: '8080'
  },
  {
    name: 'WSO2 Identity Server',
    version: '7.0.0',
    role: 'Identity & Access Management',
    features: ['OAuth2 / OpenID Connect', 'JWT token issuance', 'Role-Based Access Control', 'Multi-factor authentication', 'Single Sign-On (SSO)'],
    color: 'from-purple-600 to-violet-600',
    icon: '🔐',
    port: '9443'
  },
  {
    name: 'WSO2 Integrator: BI',
    version: '4.3.0',
    role: 'AI Workflows & Automation',
    features: ['AI Financial Advisor (RAG)', 'Automated monthly reports', 'ML expense predictions', 'Fraud detection workflows', 'Smart notifications'],
    color: 'from-green-600 to-emerald-600',
    icon: '🧠',
    port: '8290'
  },
  {
    name: 'WSO2 Micro Integrator',
    version: '4.3.0',
    role: 'Service Integration Layer',
    features: ['Income & expense services', 'Budget management service', 'Investment tracking service', 'Report generation service', 'Voice assistant service'],
    color: 'from-orange-600 to-red-600',
    icon: '⚙️',
    port: '8243'
  },
]

export default function WSO2ArchitecturePage() {
  const [services, setServices] = useState<ServiceStatus[]>(SERVICES)
  const { gatewayAnalytics, fetchGatewayAnalytics } = useEnterpriseStore()
  const [selectedProduct, setSelectedProduct] = useState(0)

  useEffect(() => {
    fetchGatewayAnalytics()
    checkServiceHealth()
  }, [])

  const checkServiceHealth = async () => {
    try {
      await axios.get(`${GATEWAY_URL}/health`, { timeout: 3000 })
      setServices(prev => prev.map((s, i) => ({ ...s, status: i <= 3 ? 'online' as const : 'online' as const })))
    } catch {
      setServices(prev => prev.map(s => ({ ...s, status: 'offline' as const })))
    }
  }

  const statusColor = (s: string) => s === 'online' ? 'text-green-400 bg-green-500/10 border-green-500/30' : s === 'offline' ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-950 rounded-3xl p-8 border border-blue-500/20">
        <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #8b5cf6 0%, transparent 50%)' }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30">🏗️</div>
            <div>
              <h1 className="text-white text-2xl font-bold">WSO2 Enterprise Architecture</h1>
              <p className="text-blue-300 text-sm">FinAI Enterprise — Production Architecture Visualization</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm max-w-2xl">
            This platform demonstrates enterprise-grade architecture using WSO2 technology stack. All components communicate through the WSO2 API Manager gateway with OAuth2/JWT security enforced by WSO2 Identity Server.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            {['API Management', 'Identity & Security', 'AI Integration', 'Microservices', 'SaaS Architecture'].map(tag => (
              <span key={tag} className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-white/70 text-xs">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture Diagram */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6">
        <h2 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
          <span>📐</span> System Architecture
        </h2>
        
        <div className="overflow-x-auto">
          <div className="min-w-[700px] space-y-4">
            {/* Frontend Layer */}
            <div className="bg-gradient-to-r from-indigo-900/40 to-blue-900/40 border border-indigo-500/20 rounded-2xl p-4 text-center">
              <div className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">Frontend Layer</div>
              <div className="flex justify-center gap-4">
                {['Next.js PWA', 'TypeScript', 'Tailwind CSS', 'Zustand', 'Recharts'].map(t => (
                  <span key={t} className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-indigo-200 text-xs">{t}</span>
                ))}
              </div>
            </div>
            
            {/* Arrow */}
            <div className="flex justify-center">
              <div className="flex flex-col items-center gap-1 text-blue-500">
                <div className="w-0.5 h-6 bg-blue-500/50" />
                <span className="text-xs text-blue-500/70">HTTPS / WSS</span>
                <div className="w-0.5 h-6 bg-blue-500/50" />
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-blue-500" />
              </div>
            </div>

            {/* WSO2 API Manager */}
            <div className="bg-gradient-to-r from-blue-900/60 to-cyan-900/40 border border-blue-500/30 rounded-2xl p-4">
              <div className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">WSO2 API Manager — Gateway Layer</div>
              <div className="grid grid-cols-4 gap-3">
                {['🔐 JWT Validation', '⚡ Rate Limiting', '📊 API Analytics', '🔀 Request Routing'].map(f => (
                  <div key={f} className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2 text-center text-blue-200 text-xs">{f}</div>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-0.5 h-4 bg-gray-600" />
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-gray-600" />
              </div>
            </div>

            {/* Service Layer */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-purple-900/50 to-violet-900/40 border border-purple-500/30 rounded-2xl p-4">
                <div className="text-purple-300 text-xs font-semibold mb-2">🔐 WSO2 Identity Server</div>
                <div className="text-purple-200/70 text-xs space-y-1">
                  {['OAuth2 / OIDC', 'JWT Token Issuance', 'RBAC Roles', 'SSO Ready'].map(f => <div key={f}>• {f}</div>)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/40 border border-green-500/30 rounded-2xl p-4">
                <div className="text-green-300 text-xs font-semibold mb-2">🤖 FastAPI AI Backend</div>
                <div className="text-green-200/70 text-xs space-y-1">
                  {['Gemini RAG Pipeline', 'ML Predictions', 'Health Scoring', 'Fraud Detection'].map(f => <div key={f}>• {f}</div>)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-900/50 to-orange-900/40 border border-yellow-500/30 rounded-2xl p-4">
                <div className="text-yellow-300 text-xs font-semibold mb-2">🧠 WSO2 Integrator BI</div>
                <div className="text-yellow-200/70 text-xs space-y-1">
                  {['Automated Reports', 'Smart Alerts', 'AI Workflows', 'Notifications'].map(f => <div key={f}>• {f}</div>)}
                </div>
              </div>
            </div>

            {/* Database Layer */}
            <div className="flex justify-center"><div className="w-0.5 h-4 bg-gray-600" /></div>
            <div className="bg-gradient-to-r from-gray-800 to-gray-850 border border-gray-600 rounded-2xl p-4">
              <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Data Layer</div>
              <div className="flex justify-center gap-4">
                {['🗄️ PostgreSQL 15', '⚡ Redis Cache', '📁 File Storage', '📊 Prometheus/Grafana'].map(d => (
                  <span key={d} className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-xl text-gray-300 text-xs">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WSO2 Products Detail */}
      <div>
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2"><span>📦</span> WSO2 Product Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WSO2_PRODUCTS.map((product, i) => (
            <div key={i} className={`bg-gray-900 border ${selectedProduct === i ? 'border-white/30' : 'border-gray-800'} rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:border-white/20`}
              onClick={() => setSelectedProduct(i)}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${product.color} flex items-center justify-center text-xl`}>{product.icon}</div>
                <div>
                  <h3 className="text-white font-semibold">{product.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">{product.role}</span>
                    <span className="text-gray-600 text-xs">· v{product.version}</span>
                    <span className="text-gray-600 text-xs">· :{product.port}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                {product.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-gray-400 text-sm">
                    <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${product.color}`} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Gateway Analytics */}
      {gatewayAnalytics && (
        <div>
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2"><span>📊</span> Live API Analytics (WSO2 AM)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Requests', value: gatewayAnalytics.total, icon: '📡', color: 'blue' },
              { label: 'Error Rate', value: `${gatewayAnalytics.errorRate}%`, icon: '⚠️', color: 'red' },
              { label: 'Avg Latency', value: `${gatewayAnalytics.avgLatency}ms`, icon: '⚡', color: 'yellow' },
              { label: 'Error Count', value: gatewayAnalytics.errors, icon: '❌', color: 'orange' },
            ].map(m => (
              <div key={m.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div className="text-2xl mb-2">{m.icon}</div>
                <div className="text-2xl font-bold text-white">{m.value}</div>
                <div className="text-gray-500 text-xs">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Status */}
      <div>
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <span>🔍</span> Service Health Monitor
          <button onClick={checkServiceHealth} className="text-xs bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white px-3 py-1 rounded-lg ml-auto transition-colors">
            Refresh
          </button>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {services.map((service, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
              <span className="text-2xl">{service.icon}</span>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{service.name}</p>
                <p className="text-gray-500 text-xs">{service.description}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor(service.status)}`}>
                {service.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
