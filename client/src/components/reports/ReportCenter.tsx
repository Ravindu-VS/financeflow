import { useState } from 'react'
import { apiClient } from '../../store/enterpriseStore'
import toast from 'react-hot-toast'
import PeriodReport from './PeriodReport'

const REPORT_TYPES = [
  { id: 'monthly', label: 'Monthly Report', icon: '📅', desc: 'Complete monthly financial summary' },
  { id: 'weekly', label: 'Weekly Report', icon: '📆', desc: '7-day income & expense breakdown' },
  { id: 'yearly', label: 'Yearly Report', icon: '📊', desc: 'Annual financial performance review' },
  { id: 'custom', label: 'Custom Period', icon: '✂️', desc: 'Select any date range' },
]

const FORMATS = [
  { id: 'pdf', label: 'PDF Report', icon: '📄', desc: 'Professional formatted report' },
  { id: 'excel', label: 'Excel Spreadsheet', icon: '📗', desc: 'With charts and multiple sheets' },
  { id: 'csv', label: 'CSV Data Export', icon: '📋', desc: 'Raw data for analysis' },
]

interface Report {
  id: string
  title: string
  type: string
  format: string
  status: string
  download_url: string | null
  created_at: string
}

export default function ReportCenter() {
  const [selectedType, setSelectedType] = useState('monthly')
  const [selectedFormat, setSelectedFormat] = useState('pdf')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [reports, setReports] = useState<Report[]>([])

  const getDefaultDates = (type: string) => {
    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split('T')[0]
    if (type === 'monthly') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { start: formatDate(start), end: formatDate(end) }
    }
    if (type === 'weekly') {
      const start = new Date(today); start.setDate(today.getDate() - 7)
      return { start: formatDate(start), end: formatDate(today) }
    }
    if (type === 'yearly') {
      return { start: `${today.getFullYear()}-01-01`, end: `${today.getFullYear()}-12-31` }
    }
    return { start: formatDate(new Date(today.getTime() - 30 * 86400000)), end: formatDate(today) }
  }

  const handleGenerate = async () => {
    const dates = selectedType !== 'custom' ? getDefaultDates(selectedType) : { start: startDate, end: endDate }
    if (!dates.start || !dates.end) { toast.error('Please set date range'); return }

    setGenerating(true)
    try {
      const { data } = await apiClient.post('/api/v1/reports/generate', {
        type: selectedType,
        format: selectedFormat,
        period_start: dates.start,
        period_end: dates.end
      })

      toast.success('Report generated! Downloading...')

      // Trigger download
      if (data.download_url) {
        const link = document.createElement('a')
        link.href = `${import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080'}${data.download_url}`
        link.download = `finai-report.${selectedFormat}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }

      setReports(prev => [{
        id: data.report_id,
        title: `${selectedType} ${selectedFormat.toUpperCase()} Report`,
        type: selectedType,
        format: selectedFormat,
        status: 'ready',
        download_url: data.download_url,
        created_at: new Date().toISOString()
      }, ...prev])
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Report generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 lg:pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 print:hidden">📑 Report Center</h1>
        <p className="text-gray-500 text-sm mt-1 print:hidden">Reports always follow the selected period</p>
      </div>

      <PeriodReport />

      <div className="print:hidden">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Server-generated reports</h2>
        <p className="text-xs text-gray-500 mt-0.5">Requires the enterprise AI backend (FastAPI via WSO2 gateway) to be running and signed in. Automated by the WSO2 Integrator BI workflow.</p>
      </div>

      <div className="space-y-8 print:hidden">
      {/* Report Type Selection */}
      <div>
        <h2 className="text-white font-semibold mb-3">Report Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {REPORT_TYPES.map(type => (
            <button key={type.id} onClick={() => setSelectedType(type.id)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 ${selectedType === type.id ? 'bg-green-500/10 border-green-500/40 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'}`}>
              <div className="text-2xl mb-2">{type.icon}</div>
              <p className="font-medium text-sm">{type.label}</p>
              <p className="text-xs opacity-60 mt-0.5">{type.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range */}
      {selectedType === 'custom' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-500/50 transition-colors" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-500/50 transition-colors" />
          </div>
        </div>
      )}

      {/* Format Selection */}
      <div>
        <h2 className="text-white font-semibold mb-3">Export Format</h2>
        <div className="grid grid-cols-3 gap-3">
          {FORMATS.map(fmt => (
            <button key={fmt.id} onClick={() => setSelectedFormat(fmt.id)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 ${selectedFormat === fmt.id ? 'bg-blue-500/10 border-blue-500/40 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'}`}>
              <div className="text-2xl mb-2">{fmt.icon}</div>
              <p className="font-medium text-sm">{fmt.label}</p>
              <p className="text-xs opacity-60 mt-0.5">{fmt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button onClick={handleGenerate} disabled={generating}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white py-4 rounded-2xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-2xl shadow-green-500/20">
        {generating ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating {selectedFormat.toUpperCase()} Report...
          </>
        ) : (
          <>📥 Generate & Download {selectedFormat.toUpperCase()} Report</>
        )}
      </button>

      {/* Recent Reports */}
      {reports.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Recent Reports</h2>
          <div className="space-y-3">
            {reports.map(report => (
              <div key={report.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
                <span className="text-2xl">{report.format === 'pdf' ? '📄' : report.format === 'excel' ? '📗' : '📋'}</span>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{report.title}</p>
                  <p className="text-gray-500 text-xs">{new Date(report.created_at).toLocaleString()}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${report.status === 'ready' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'}`}>
                  {report.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
