import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { marketService } from '../../services/firebaseService'
import { Card, SectionHeader, Button } from '../ui'
import {
  BuildingLibraryIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  GlobeAltIcon,
  BuildingOffice2Icon,
  BanknotesIcon,
  SparklesIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'

interface MarketIndex {
  name: string
  value: number
  change: number
  changePercent: number
}

interface StockItem {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: string
  marketCap: string
  pe: number
  prediction: 'bullish' | 'bearish' | 'neutral'
}

interface StockPrediction {
  symbol: string
  name: string
  currentPrice: number
  target1M: number
  target3M: number
  target1Y: number
  sentiment: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish'
  confidence: number
  factors: string[]
}

interface BankRate {
  bank: string
  logo: string
  savingsRate: number
  fdRate6M: number
  fdRate1Y: number
  loanRate: number
}

interface NewsItem {
  title: string
  source: string
  url: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

export default function MarketPage() {
  const [loading, setLoading] = useState(true)
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'predictions' | 'advice'>('overview')
  const [activeSubTab, setActiveSubTab] = useState<'indices' | 'stocks' | 'banks'>('indices')

  const fetchMarketData = async () => {
    try {
      setLoading(true)
      const data = await marketService.getOverview()
      setIndices(data.indices || mockIndices)
      // Map news data to include sentiment if missing
      const newsWithSentiment = (data.news || mockNews).map((item: any) => ({
        ...item,
        sentiment: item.sentiment || 'neutral'
      }))
      setNews(newsWithSentiment)
    } catch (error) {
      setIndices(mockIndices)
      setNews(mockNews)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMarketData()
  }, [])

  // CSE Market Indices
  const mockIndices: MarketIndex[] = [
    { name: 'CSE All Share (ASPI)', value: 12847.50, change: 156.30, changePercent: 1.23 },
    { name: 'S&P SL20', value: 4231.94, change: 52.45, changePercent: 1.25 },
    { name: 'CSE Banking & Finance', value: 8892.30, change: -23.45, changePercent: -0.26 },
    { name: 'CSE Manufacturing', value: 6245.80, change: 45.60, changePercent: 0.73 },
    { name: 'CSE Hotels & Travel', value: 1892.45, change: 28.90, changePercent: 1.55 },
    { name: 'CSE Diversified Holdings', value: 5678.20, change: -15.30, changePercent: -0.27 },
    { name: 'USD/LKR', value: 323.45, change: 1.25, changePercent: 0.39 },
    { name: 'T-Bill 91 Day', value: 10.25, change: 0.05, changePercent: 0.49 }
  ]

  // Top CSE Stocks with predictions
  const topStocks: StockItem[] = [
    { symbol: 'JKH', name: 'John Keells Holdings PLC', price: 198.50, change: 4.25, changePercent: 2.19, volume: '2.1M', marketCap: 'Rs. 280B', pe: 18.5, prediction: 'bullish' },
    { symbol: 'COMB', name: 'Commercial Bank of Ceylon', price: 98.75, change: -1.50, changePercent: -1.50, volume: '1.8M', marketCap: 'Rs. 165B', pe: 6.2, prediction: 'bullish' },
    { symbol: 'SAMP', name: 'Sampath Bank PLC', price: 76.25, change: 2.00, changePercent: 2.70, volume: '1.5M', marketCap: 'Rs. 89B', pe: 5.8, prediction: 'bullish' },
    { symbol: 'HNB', name: 'Hatton National Bank', price: 185.00, change: 3.75, changePercent: 2.07, volume: '980K', marketCap: 'Rs. 98B', pe: 5.5, prediction: 'bullish' },
    { symbol: 'DIAL', name: 'Dialog Axiata PLC', price: 12.80, change: 0.30, changePercent: 2.40, volume: '3.2M', marketCap: 'Rs. 105B', pe: 12.3, prediction: 'neutral' },
    { symbol: 'CARG', name: 'Cargills Ceylon PLC', price: 245.00, change: -5.00, changePercent: -2.00, volume: '450K', marketCap: 'Rs. 64B', pe: 15.2, prediction: 'neutral' },
    { symbol: 'HAYL', name: 'Hayleys PLC', price: 89.50, change: 1.75, changePercent: 1.99, volume: '720K', marketCap: 'Rs. 67B', pe: 8.9, prediction: 'bullish' },
    { symbol: 'CTCE', name: 'Ceylon Tobacco Company', price: 1250.00, change: 15.00, changePercent: 1.21, volume: '125K', marketCap: 'Rs. 234B', pe: 9.8, prediction: 'neutral' },
    { symbol: 'HNBF', name: 'HNB Finance PLC', price: 8.20, change: 0.10, changePercent: 1.23, volume: '890K', marketCap: 'Rs. 4.5B', pe: 4.2, prediction: 'bullish' },
    { symbol: 'TKYO', name: 'Tokyo Cement Company', price: 56.75, change: -0.75, changePercent: -1.30, volume: '650K', marketCap: 'Rs. 28B', pe: 7.5, prediction: 'bearish' }
  ]

  // Stock Predictions
  const stockPredictions: StockPrediction[] = [
    {
      symbol: 'JKH',
      name: 'John Keells Holdings',
      currentPrice: 198.50,
      target1M: 210,
      target3M: 235,
      target1Y: 280,
      sentiment: 'bullish',
      confidence: 75,
      factors: ['Diversified portfolio', 'Tourism recovery', 'Strong management', 'Export earnings growth']
    },
    {
      symbol: 'COMB',
      name: 'Commercial Bank',
      currentPrice: 98.75,
      target1M: 105,
      target3M: 118,
      target1Y: 135,
      sentiment: 'very_bullish',
      confidence: 80,
      factors: ['Low P/E ratio', 'Strong deposit base', 'Digital banking growth', 'NIM improvement']
    },
    {
      symbol: 'SAMP',
      name: 'Sampath Bank',
      currentPrice: 76.25,
      target1M: 82,
      target3M: 92,
      target1Y: 110,
      sentiment: 'bullish',
      confidence: 72,
      factors: ['Undervalued stock', 'Branch expansion', 'SME lending focus', 'Cost optimization']
    },
    {
      symbol: 'DIAL',
      name: 'Dialog Axiata',
      currentPrice: 12.80,
      target1M: 13.50,
      target3M: 14.50,
      target1Y: 16.00,
      sentiment: 'neutral',
      confidence: 65,
      factors: ['5G rollout potential', 'Data revenue growth', 'Competition pressure', 'Regulatory changes']
    },
    {
      symbol: 'TKYO',
      name: 'Tokyo Cement',
      currentPrice: 56.75,
      target1M: 54,
      target3M: 52,
      target1Y: 55,
      sentiment: 'bearish',
      confidence: 60,
      factors: ['Construction slowdown', 'High input costs', 'Debt concerns', 'Import restrictions help']
    }
  ]

  // Sri Lankan Bank Interest Rates
  const bankRates: BankRate[] = [
    { bank: 'Bank of Ceylon', logo: '🏛️', savingsRate: 3.00, fdRate6M: 8.50, fdRate1Y: 9.00, loanRate: 14.50 },
    { bank: 'People\'s Bank', logo: '🏦', savingsRate: 3.00, fdRate6M: 8.25, fdRate1Y: 8.75, loanRate: 14.25 },
    { bank: 'Commercial Bank', logo: '💼', savingsRate: 3.25, fdRate6M: 8.75, fdRate1Y: 9.25, loanRate: 13.50 },
    { bank: 'Sampath Bank', logo: '🌟', savingsRate: 3.50, fdRate6M: 9.00, fdRate1Y: 9.50, loanRate: 13.75 },
    { bank: 'Hatton National Bank', logo: '🏔️', savingsRate: 3.25, fdRate6M: 8.50, fdRate1Y: 9.00, loanRate: 13.50 },
    { bank: 'Nations Trust Bank', logo: '🌍', savingsRate: 3.50, fdRate6M: 9.25, fdRate1Y: 9.75, loanRate: 14.00 },
    { bank: 'Seylan Bank', logo: '🦁', savingsRate: 3.25, fdRate6M: 8.75, fdRate1Y: 9.25, loanRate: 14.00 },
    { bank: 'DFCC Bank', logo: '📊', savingsRate: 3.00, fdRate6M: 9.00, fdRate1Y: 9.50, loanRate: 13.75 },
    { bank: 'NDB Bank', logo: '💎', savingsRate: 3.25, fdRate6M: 8.75, fdRate1Y: 9.25, loanRate: 13.50 },
    { bank: 'Pan Asia Bank', logo: '🌏', savingsRate: 3.50, fdRate6M: 9.50, fdRate1Y: 10.00, loanRate: 14.25 }
  ]

  const mockNews: NewsItem[] = [
    { title: 'Central Bank Maintains Policy Rates, Signals Stable Outlook', source: 'Daily FT', url: '#', publishedAt: '2024-01-15T10:30:00Z', sentiment: 'positive' },
    { title: 'CSE Records Highest Single-Day Turnover in 2024', source: 'Sunday Times', url: '#', publishedAt: '2024-01-15T09:15:00Z', sentiment: 'positive' },
    { title: 'Sri Lanka Rupee Strengthens Against Major Currencies', source: 'Daily Mirror', url: '#', publishedAt: '2024-01-15T08:45:00Z', sentiment: 'positive' },
    { title: 'Foreign Investors Show Renewed Interest in Colombo Bourse', source: 'The Island', url: '#', publishedAt: '2024-01-14T16:30:00Z', sentiment: 'positive' },
    { title: 'Banking Sector NPLs Decline as Economy Stabilizes', source: 'Economy Next', url: '#', publishedAt: '2024-01-14T14:00:00Z', sentiment: 'neutral' }
  ]

  const displayIndices = indices.length > 0 ? indices : mockIndices
  const displayNews = news.length > 0 ? news : mockNews

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'very_bullish': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
      case 'bullish': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
      case 'neutral': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
      case 'bearish': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30'
      case 'very_bearish': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30'
    }
  }

  const getPredictionBadge = (prediction: string) => {
    switch (prediction) {
      case 'bullish': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'bearish': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Colombo Stock Exchange</h1>
          <p className="text-gray-500 dark:text-gray-400">Sri Lankan market data, predictions & investment advice</p>
        </div>
        <div className="flex gap-2">
          <Link to="/global-markets">
            <Button variant="outline" icon={<GlobeAltIcon className="w-5 h-5" />}>
              Global Markets
            </Button>
          </Link>
          <Link to="/crypto">
            <Button variant="outline" icon={<CurrencyDollarIcon className="w-5 h-5" />}>
              Crypto
            </Button>
          </Link>
        </div>
      </div>

      {/* Market Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <BuildingLibraryIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">CSE Status</p>
          <p className="text-lg font-bold text-green-500">Open</p>
          <p className="text-xs text-gray-400">9:30 AM - 2:30 PM</p>
        </Card>
        <Card className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">ASPI</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">12,847.50</p>
          <p className="text-sm text-green-500">+1.23%</p>
        </Card>
        <Card className="text-center">
          <div className="text-2xl mb-2">💹</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Daily Turnover</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">Rs. 2.8B</p>
          <p className="text-sm text-green-500">+15.2%</p>
        </Card>
        <Card className="text-center">
          <div className="text-2xl mb-2">😊</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Market Sentiment</p>
          <p className="text-lg font-bold text-green-500">68 - Greed</p>
          <p className="text-xs text-gray-400">Bullish outlook</p>
        </Card>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <ChartBarIcon className="w-4 h-4 inline-block mr-2" />
          Market Overview
        </button>
        <button
          onClick={() => setActiveTab('predictions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'predictions'
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <SparklesIcon className="w-4 h-4 inline-block mr-2" />
          Price Predictions
        </button>
        <button
          onClick={() => setActiveTab('advice')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'advice'
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <LightBulbIcon className="w-4 h-4 inline-block mr-2" />
          Investment Advice
        </button>
      </div>

      {/* Market Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Sub Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSubTab('indices')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeSubTab === 'indices'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Market Indices
            </button>
            <button
              onClick={() => setActiveSubTab('stocks')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeSubTab === 'stocks'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Top Stocks
            </button>
            <button
              onClick={() => setActiveSubTab('banks')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeSubTab === 'banks'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Bank Rates
            </button>
          </div>

          {/* Market Indices */}
          {activeSubTab === 'indices' && (
            <Card>
              <SectionHeader title="CSE Market Indices" subtitle="Live Colombo Stock Exchange data" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {displayIndices.map((index) => (
                  <div key={index.name} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{index.name}</span>
                      {index.change >= 0 ? (
                        <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {index.value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={index.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}
                      </span>
                      <span className={`text-sm ${index.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ({index.change >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Top Stocks */}
          {activeSubTab === 'stocks' && (
            <Card>
              <SectionHeader title="Top CSE Stocks" subtitle="Most active stocks with outlook indicators" />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-3 font-medium">Symbol</th>
                      <th className="pb-3 font-medium">Company</th>
                      <th className="pb-3 font-medium text-right">Price (Rs.)</th>
                      <th className="pb-3 font-medium text-right">Change</th>
                      <th className="pb-3 font-medium text-right">P/E</th>
                      <th className="pb-3 font-medium text-right">Market Cap</th>
                      <th className="pb-3 font-medium text-center">Outlook</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {topStocks.map((stock) => (
                      <tr key={stock.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3">
                          <span className="font-bold text-primary-600 dark:text-primary-400">{stock.symbol}</span>
                        </td>
                        <td className="py-3 text-gray-900 dark:text-white">{stock.name}</td>
                        <td className="py-3 text-right font-medium text-gray-900 dark:text-white">
                          {stock.price.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`py-3 text-right ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {stock.change >= 0 ? (
                              <ArrowTrendingUpIcon className="w-4 h-4" />
                            ) : (
                              <ArrowTrendingDownIcon className="w-4 h-4" />
                            )}
                            {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                          </div>
                        </td>
                        <td className="py-3 text-right text-gray-500 dark:text-gray-400">{stock.pe.toFixed(1)}</td>
                        <td className="py-3 text-right text-gray-500 dark:text-gray-400">{stock.marketCap}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPredictionBadge(stock.prediction)}`}>
                            {stock.prediction.charAt(0).toUpperCase() + stock.prediction.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Bank Rates */}
          {activeSubTab === 'banks' && (
            <Card>
              <SectionHeader 
                title="Sri Lankan Bank Interest Rates" 
                subtitle="Compare savings, FD, and loan rates across major banks"
                action={<span className="text-xs text-gray-500 dark:text-gray-400">*Rates are indicative</span>}
              />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-3 font-medium">Bank</th>
                      <th className="pb-3 font-medium text-center">Savings Rate</th>
                      <th className="pb-3 font-medium text-center">FD (6 Months)</th>
                      <th className="pb-3 font-medium text-center">FD (1 Year)</th>
                      <th className="pb-3 font-medium text-center">Personal Loan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {bankRates.map((bank) => (
                      <tr key={bank.bank} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{bank.logo}</span>
                            <span className="font-medium text-gray-900 dark:text-white">{bank.bank}</span>
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md text-sm font-medium">
                            {bank.savingsRate.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-md text-sm font-medium">
                            {bank.fdRate6M.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-md text-sm font-medium">
                            {bank.fdRate1Y.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-md text-sm font-medium">
                            {bank.loanRate.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* CBSL Rates Card */}
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3 mb-3">
                  <BanknotesIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">Central Bank of Sri Lanka (CBSL) Policy Rates</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">SDFR</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">9.00%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">SLFR</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">10.00%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">SRR</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">2.00%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Bank Rate</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">15.00%</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Financial News */}
          <Card>
            <SectionHeader 
              title="Sri Lankan Financial News" 
              subtitle="Latest updates with sentiment indicators"
              action={
                <a href="https://www.ft.lk/business" target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:text-primary-600">
                  View all
                </a>
              }
            />
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {displayNews.map((item, index) => (
                <div key={index} className="py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    item.sentiment === 'positive' ? 'bg-green-500' : 
                    item.sentiment === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-gray-900 dark:text-white">{item.title}</p>
                    <p className="text-sm text-gray-500">{item.source} • {new Date(item.publishedAt).toLocaleDateString('en-LK')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Predictions Tab */}
      {activeTab === 'predictions' && (
        <>
          {/* Disclaimer */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800 dark:text-amber-200">Disclaimer</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                These predictions are based on technical and fundamental analysis. Stock markets are subject to risks. 
                This is not financial advice. Always do your own research before investing.
              </p>
            </div>
          </div>

          <Card>
            <SectionHeader title="Stock Price Predictions" subtitle="Based on technical & fundamental analysis" />
            <div className="space-y-6">
              {stockPredictions.map((pred) => (
                <div key={pred.symbol} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
                        {pred.symbol.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{pred.name} ({pred.symbol})</h3>
                        <p className="text-sm text-gray-500">Current: Rs. {pred.currentPrice.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(pred.sentiment)}`}>
                        {pred.sentiment.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                        {pred.confidence}% confidence
                      </span>
                    </div>
                  </div>

                  {/* Price Predictions */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">1 Month Target</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">Rs. {pred.target1M.toLocaleString()}</p>
                      <p className={`text-sm ${pred.target1M > pred.currentPrice ? 'text-green-500' : 'text-red-500'}`}>
                        {pred.target1M > pred.currentPrice ? '+' : ''}{(((pred.target1M - pred.currentPrice) / pred.currentPrice) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">3 Month Target</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">Rs. {pred.target3M.toLocaleString()}</p>
                      <p className={`text-sm ${pred.target3M > pred.currentPrice ? 'text-green-500' : 'text-red-500'}`}>
                        {pred.target3M > pred.currentPrice ? '+' : ''}{(((pred.target3M - pred.currentPrice) / pred.currentPrice) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">1 Year Target</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">Rs. {pred.target1Y.toLocaleString()}</p>
                      <p className={`text-sm ${pred.target1Y > pred.currentPrice ? 'text-green-500' : 'text-red-500'}`}>
                        {pred.target1Y > pred.currentPrice ? '+' : ''}{(((pred.target1Y - pred.currentPrice) / pred.currentPrice) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Key Factors */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Factors:</p>
                    <div className="flex flex-wrap gap-2">
                      {pred.factors.map((factor, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Investment Advice Tab */}
      {activeTab === 'advice' && (
        <>
          {/* Risk Warning */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 flex items-start gap-3">
            <ShieldCheckIcon className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200">Investment in CSE</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                The Colombo Stock Exchange is regulated by the Securities and Exchange Commission of Sri Lanka (SEC). 
                All investments carry risk. Consider consulting a licensed investment advisor.
              </p>
            </div>
          </div>

          {/* Investment Strategies */}
          <Card>
            <SectionHeader title="Investment Strategies" subtitle="Smart approaches for CSE investing" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Value Investing</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Look for stocks with low P/E ratios, strong dividends, and solid fundamentals. Many banking stocks on CSE offer excellent value.
                </p>
                <div className="text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded inline-block">
                  ✓ Recommended for beginners
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <ChartBarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Dividend Investing</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Focus on companies with consistent dividend payouts. CTC, JKH, and banking stocks typically offer good dividends.
                </p>
                <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded inline-block">
                  ✓ Passive income strategy
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                  <BuildingOffice2Icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Sector Rotation</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Rotate between sectors based on economic cycles. Banking during rate cuts, tourism during recovery, manufacturing during growth.
                </p>
                <div className="text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded inline-block">
                  ✓ For intermediate investors
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-3">
                  <BanknotesIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Unit Trusts</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Invest through SEC-regulated unit trusts for professional management. Options include NDB Wealth, Capital Alliance, and JB Vantage.
                </p>
                <div className="text-xs text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded inline-block">
                  ✓ Diversified & managed
                </div>
              </div>
            </div>
          </Card>

          {/* Portfolio Allocation */}
          <Card>
            <SectionHeader title="Recommended Allocation" subtitle="Based on your risk tolerance" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">🛡️ Conservative</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>Fixed Deposits</span><span className="font-medium">40%</span></li>
                  <li className="flex justify-between"><span>Treasury Bills/Bonds</span><span className="font-medium">30%</span></li>
                  <li className="flex justify-between"><span>Blue Chip Stocks</span><span className="font-medium">20%</span></li>
                  <li className="flex justify-between"><span>Unit Trusts</span><span className="font-medium">10%</span></li>
                </ul>
                <p className="mt-3 text-xs text-green-700 dark:text-green-300">Best for: Retirees, capital preservation</p>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3">⚖️ Balanced</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>Blue Chip Stocks</span><span className="font-medium">35%</span></li>
                  <li className="flex justify-between"><span>Fixed Deposits</span><span className="font-medium">25%</span></li>
                  <li className="flex justify-between"><span>Unit Trusts</span><span className="font-medium">20%</span></li>
                  <li className="flex justify-between"><span>Mid-Cap Stocks</span><span className="font-medium">15%</span></li>
                  <li className="flex justify-between"><span>Gold/Real Estate</span><span className="font-medium">5%</span></li>
                </ul>
                <p className="mt-3 text-xs text-yellow-700 dark:text-yellow-300">Best for: Working professionals</p>
              </div>

              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-3">🔥 Aggressive</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>Growth Stocks</span><span className="font-medium">45%</span></li>
                  <li className="flex justify-between"><span>Mid-Cap Stocks</span><span className="font-medium">25%</span></li>
                  <li className="flex justify-between"><span>Small-Cap Stocks</span><span className="font-medium">15%</span></li>
                  <li className="flex justify-between"><span>Unit Trusts</span><span className="font-medium">10%</span></li>
                  <li className="flex justify-between"><span>Cash</span><span className="font-medium">5%</span></li>
                </ul>
                <p className="mt-3 text-xs text-red-700 dark:text-red-300">Best for: Young investors, high risk tolerance</p>
              </div>
            </div>
          </Card>

          {/* How to Invest */}
          <Card>
            <SectionHeader title="How to Start Investing in CSE" subtitle="Step-by-step guide for beginners" />
            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold flex-shrink-0">1</div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Open a CDS Account</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Contact a licensed stockbroker (e.g., John Keells Stock Brokers, NDB Securities, CT CLSA) to open a Central Depository System (CDS) account.</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold flex-shrink-0">2</div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Fund Your Account</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Transfer funds to your broker's trust account. Start with an amount you're comfortable losing while learning.</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold flex-shrink-0">3</div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Research & Buy</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Use CSE website, broker research reports, and this app to research stocks. Place buy orders through your broker or online platform.</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Common Mistakes */}
          <Card>
            <SectionHeader title="Common Mistakes to Avoid" subtitle="Learn from others' errors" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Following Tips Blindly</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Don't buy stocks based on rumors or tips without research</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">No Diversification</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Putting all money in one stock or sector is risky</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Ignoring Fundamentals</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Always check P/E ratio, dividends, and financial statements</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Emotional Trading</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Don't panic sell during market dips or FOMO buy during rallies</p>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
