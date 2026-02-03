import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionHeader, Button } from '../ui'
import {
  GlobeAltIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BuildingLibraryIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  LightBulbIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline'

interface GlobalIndex {
  name: string
  country: string
  flag: string
  value: number
  change: number
  changePercent: number
  status: 'open' | 'closed' | 'pre-market' | 'after-hours'
}

interface CurrencyPair {
  pair: string
  name: string
  rate: number
  change: number
  changePercent: number
}

interface CommodityPrice {
  name: string
  symbol: string
  price: number
  unit: string
  change: number
  changePercent: number
}

interface GlobalNews {
  title: string
  source: string
  url: string
  publishedAt: string
  region: string
  sentiment?: 'positive' | 'negative' | 'neutral'
}

interface MarketPrediction {
  market: string
  flag: string
  currentValue: number
  target1M: number
  target3M: number
  target1Y: number
  sentiment: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish'
  confidence: number
  factors: string[]
}

export default function GlobalMarketsPage() {
  const [loading, setLoading] = useState(true)
  const [activeRegion, setActiveRegion] = useState<'all' | 'americas' | 'europe' | 'asia' | 'srilanka'>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'predictions' | 'advice'>('overview')

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500)
  }, [])

  // Global Market Indices
  const globalIndices: GlobalIndex[] = [
    // Americas
    { name: 'S&P 500', country: 'USA', flag: '🇺🇸', value: 4783.45, change: 25.78, changePercent: 0.54, status: 'open' },
    { name: 'Dow Jones', country: 'USA', flag: '🇺🇸', value: 37545.33, change: 145.23, changePercent: 0.39, status: 'open' },
    { name: 'NASDAQ', country: 'USA', flag: '🇺🇸', value: 15074.57, change: 78.92, changePercent: 0.53, status: 'open' },
    { name: 'TSX Composite', country: 'Canada', flag: '🇨🇦', value: 21045.78, change: -45.32, changePercent: -0.21, status: 'open' },
    { name: 'Bovespa', country: 'Brazil', flag: '🇧🇷', value: 132456.78, change: 890.45, changePercent: 0.68, status: 'closed' },
    
    // Europe
    { name: 'FTSE 100', country: 'UK', flag: '🇬🇧', value: 7624.93, change: -32.45, changePercent: -0.42, status: 'closed' },
    { name: 'DAX', country: 'Germany', flag: '🇩🇪', value: 16751.64, change: 89.23, changePercent: 0.54, status: 'closed' },
    { name: 'CAC 40', country: 'France', flag: '🇫🇷', value: 7543.18, change: 45.67, changePercent: 0.61, status: 'closed' },
    { name: 'Euro Stoxx 50', country: 'Europe', flag: '🇪🇺', value: 4521.34, change: 28.56, changePercent: 0.64, status: 'closed' },
    { name: 'Swiss Market', country: 'Switzerland', flag: '🇨🇭', value: 11245.67, change: -15.23, changePercent: -0.14, status: 'closed' },
    
    // Asia Pacific
    { name: 'Nikkei 225', country: 'Japan', flag: '🇯🇵', value: 33464.17, change: 234.56, changePercent: 0.71, status: 'closed' },
    { name: 'Shanghai Composite', country: 'China', flag: '🇨🇳', value: 2974.93, change: -12.34, changePercent: -0.41, status: 'closed' },
    { name: 'Hang Seng', country: 'Hong Kong', flag: '🇭🇰', value: 16830.30, change: -145.67, changePercent: -0.86, status: 'closed' },
    { name: 'BSE Sensex', country: 'India', flag: '🇮🇳', value: 72085.63, change: 567.89, changePercent: 0.79, status: 'closed' },
    { name: 'Nifty 50', country: 'India', flag: '🇮🇳', value: 21731.40, change: 178.45, changePercent: 0.83, status: 'closed' },
    { name: 'ASX 200', country: 'Australia', flag: '🇦🇺', value: 7589.23, change: 34.56, changePercent: 0.46, status: 'closed' },
    { name: 'KOSPI', country: 'South Korea', flag: '🇰🇷', value: 2655.28, change: 23.45, changePercent: 0.89, status: 'closed' },
    { name: 'Straits Times', country: 'Singapore', flag: '🇸🇬', value: 3187.45, change: -8.23, changePercent: -0.26, status: 'closed' },
    // Sri Lanka
    { name: 'CSE All Share (ASPI)', country: 'Sri Lanka', flag: '🇱🇰', value: 11234.56, change: 45.23, changePercent: 0.40, status: 'closed' },
    { name: 'S&P Sri Lanka 20', country: 'Sri Lanka', flag: '🇱🇰', value: 3456.78, change: 12.34, changePercent: 0.36, status: 'closed' },
  ]

  // Currency Exchange Rates (against LKR)
  const currencyRates: CurrencyPair[] = [
    { pair: 'USD/LKR', name: 'US Dollar', rate: 323.45, change: 1.25, changePercent: 0.39 },
    { pair: 'EUR/LKR', name: 'Euro', rate: 356.78, change: 2.15, changePercent: 0.61 },
    { pair: 'GBP/LKR', name: 'British Pound', rate: 412.34, change: -1.56, changePercent: -0.38 },
    { pair: 'JPY/LKR', name: 'Japanese Yen', rate: 2.29, change: 0.02, changePercent: 0.88 },
    { pair: 'AUD/LKR', name: 'Australian Dollar', rate: 218.90, change: 0.85, changePercent: 0.39 },
    { pair: 'INR/LKR', name: 'Indian Rupee', rate: 3.89, change: 0.01, changePercent: 0.26 },
    { pair: 'SGD/LKR', name: 'Singapore Dollar', rate: 244.56, change: 1.12, changePercent: 0.46 },
    { pair: 'CNY/LKR', name: 'Chinese Yuan', rate: 45.67, change: -0.23, changePercent: -0.50 },
  ]

  // Global Commodity Prices
  const commodities: CommodityPrice[] = [
    { name: 'Gold', symbol: 'XAU', price: 2045.30, unit: 'oz', change: 12.50, changePercent: 0.61 },
    { name: 'Silver', symbol: 'XAG', price: 23.45, unit: 'oz', change: 0.35, changePercent: 1.51 },
    { name: 'Crude Oil (WTI)', symbol: 'CL', price: 72.34, unit: 'bbl', change: -1.23, changePercent: -1.67 },
    { name: 'Brent Crude', symbol: 'BRN', price: 77.89, unit: 'bbl', change: -0.95, changePercent: -1.21 },
    { name: 'Natural Gas', symbol: 'NG', price: 2.56, unit: 'MMBtu', change: 0.08, changePercent: 3.23 },
    { name: 'Copper', symbol: 'HG', price: 3.89, unit: 'lb', change: 0.05, changePercent: 1.30 },
    { name: 'Wheat', symbol: 'ZW', price: 612.50, unit: 'bu', change: -8.75, changePercent: -1.41 },
    { name: 'Coffee', symbol: 'KC', price: 178.90, unit: 'lb', change: 2.30, changePercent: 1.30 },
  ]

  // Global Financial News
  const globalNews: GlobalNews[] = [
    {
      title: 'Fed Signals Potential Rate Cuts in 2024, Markets Rally',
      source: 'Reuters',
      url: '#',
      publishedAt: '2024-01-15T14:30:00Z',
      region: 'Americas',
      sentiment: 'positive'
    },
    {
      title: 'European Central Bank Holds Rates, Inflation Concerns Persist',
      source: 'Bloomberg',
      url: '#',
      publishedAt: '2024-01-15T12:00:00Z',
      region: 'Europe',
      sentiment: 'neutral'
    },
    {
      title: 'China Manufacturing PMI Shows Signs of Recovery',
      source: 'CNBC',
      url: '#',
      publishedAt: '2024-01-15T08:00:00Z',
      region: 'Asia',
      sentiment: 'positive'
    },
    {
      title: 'Oil Prices Drop on Demand Concerns, OPEC+ in Focus',
      source: 'Financial Times',
      url: '#',
      publishedAt: '2024-01-15T06:30:00Z',
      region: 'Global',
      sentiment: 'negative'
    },
    {
      title: 'Japanese Yen Weakens as BOJ Maintains Ultra-Loose Policy',
      source: 'Nikkei Asia',
      url: '#',
      publishedAt: '2024-01-14T23:00:00Z',
      region: 'Asia',
      sentiment: 'neutral'
    },
    {
      title: 'UK Economy Shows Resilience Despite High Interest Rates',
      source: 'The Guardian',
      url: '#',
      publishedAt: '2024-01-14T18:00:00Z',
      region: 'Europe',
      sentiment: 'positive'
    }
  ]

  // Market Predictions
  const marketPredictions: MarketPrediction[] = [
    {
      market: 'S&P 500',
      flag: '🇺🇸',
      currentValue: 4783.45,
      target1M: 4850,
      target3M: 5000,
      target1Y: 5300,
      sentiment: 'bullish',
      confidence: 72,
      factors: ['Fed rate cuts expected', 'Strong corporate earnings', 'AI tech boom', 'Consumer spending resilient']
    },
    {
      market: 'FTSE 100',
      flag: '🇬🇧',
      currentValue: 7624.93,
      target1M: 7700,
      target3M: 7850,
      target1Y: 8100,
      sentiment: 'neutral',
      confidence: 65,
      factors: ['Brexit stabilization', 'BOE rate outlook', 'Energy sector strength', 'Valuation attractive']
    },
    {
      market: 'Nikkei 225',
      flag: '🇯🇵',
      currentValue: 33464.17,
      target1M: 34500,
      target3M: 36000,
      target1Y: 38000,
      sentiment: 'very_bullish',
      confidence: 78,
      factors: ['Weak yen benefits exporters', 'Corporate governance reforms', 'Warren Buffett investments', 'Tourism recovery']
    },
    {
      market: 'Hang Seng',
      flag: '🇭🇰',
      currentValue: 16830.30,
      target1M: 17200,
      target3M: 18000,
      target1Y: 19500,
      sentiment: 'bearish',
      confidence: 55,
      factors: ['China economy concerns', 'Property sector issues', 'Geopolitical tensions', 'Valuation discounts']
    },
    {
      market: 'BSE Sensex',
      flag: '🇮🇳',
      currentValue: 72085.63,
      target1M: 73500,
      target3M: 76000,
      target1Y: 82000,
      sentiment: 'very_bullish',
      confidence: 80,
      factors: ['Strong GDP growth', 'Domestic consumption', 'Manufacturing shift', 'Election year spending']
    }
  ]

  const getRegionIndices = () => {
    switch (activeRegion) {
      case 'americas':
        return globalIndices.filter(i => ['USA', 'Canada', 'Brazil'].includes(i.country))
      case 'europe':
        return globalIndices.filter(i => ['UK', 'Germany', 'France', 'Europe', 'Switzerland'].includes(i.country))
      case 'asia':
        return globalIndices.filter(i => ['Japan', 'China', 'Hong Kong', 'India', 'Australia', 'South Korea', 'Singapore'].includes(i.country))
      case 'srilanka':
        return globalIndices.filter(i => i.country === 'Sri Lanka')
      default:
        return globalIndices
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'closed': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
      case 'pre-market': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'after-hours': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Global Markets</h1>
          <p className="text-gray-500 dark:text-gray-400">Worldwide stock indices, currencies, commodities & predictions</p>
        </div>
        <div className="flex gap-2">
          <Link to="/market">
            <Button variant="outline" icon={<BuildingLibraryIcon className="w-5 h-5" />}>
              CSE Market
            </Button>
          </Link>
          <Link to="/crypto">
            <Button variant="outline" icon={<CurrencyDollarIcon className="w-5 h-5" />}>
              Crypto
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Market Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <div className="text-2xl mb-2">🌍</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Global Sentiment</p>
          <p className="text-lg font-bold text-green-500">62 - Greed</p>
          <p className="text-xs text-gray-400">Risk-on mode</p>
        </Card>
        <Card className="text-center">
          <div className="text-2xl mb-2">🇺🇸</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">US Markets</p>
          <p className="text-lg font-bold text-green-500">+0.54%</p>
          <p className="text-xs text-gray-400">S&P 500</p>
        </Card>
        <Card className="text-center">
          <div className="text-2xl mb-2">💱</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">USD/LKR</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">Rs. 323.45</p>
          <p className="text-xs text-yellow-500">+0.39%</p>
        </Card>
        <Card className="text-center">
          <div className="text-2xl mb-2">🪙</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gold</p>
          <p className="text-lg font-bold text-green-500">$2,045.30</p>
          <p className="text-xs text-gray-400">+0.61%</p>
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
          Market Predictions
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

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Region Filter */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
            {[
              { key: 'all', label: 'All Markets', icon: '🌍' },
              { key: 'americas', label: 'Americas', icon: '🌎' },
              { key: 'europe', label: 'Europe', icon: '🌍' },
              { key: 'asia', label: 'Asia Pacific', icon: '🌏' },
              { key: 'srilanka', label: 'Sri Lanka', icon: '🇱🇰' }
            ].map((region) => (
              <button
                key={region.key}
                onClick={() => setActiveRegion(region.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeRegion === region.key
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span className="mr-2">{region.icon}</span>
                {region.label}
              </button>
            ))}
          </div>

      {/* Global Indices */}
      <Card>
        <SectionHeader 
          title="Stock Market Indices" 
          subtitle={`${activeRegion === 'all' ? 'Major global' : activeRegion.charAt(0).toUpperCase() + activeRegion.slice(1)} stock indices`}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {getRegionIndices().map((index) => (
            <div
              key={index.name}
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{index.flag}</span>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{index.name}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{index.country}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(index.status)}`}>
                  {index.status}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {index.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {index.change >= 0 ? (
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                ) : (
                  <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
                )}
                <span className={index.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Currency Exchange Rates */}
      <Card>
        <SectionHeader 
          title="Currency Exchange Rates" 
          subtitle="Major currencies against Sri Lankan Rupee (LKR)"
          action={
            <span className="text-xs text-gray-500 dark:text-gray-400">Live rates</span>
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {currencyRates.map((currency) => (
            <div
              key={currency.pair}
              className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{currency.pair}</span>
                <CurrencyDollarIcon className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                Rs. {currency.rate.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{currency.name}</p>
              <span className={`text-sm ${currency.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {currency.change >= 0 ? '+' : ''}{currency.changePercent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Commodities */}
      <Card>
        <SectionHeader 
          title="Commodity Prices" 
          subtitle="Global commodity market prices (USD)"
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-3 font-medium">Commodity</th>
                <th className="pb-3 font-medium">Symbol</th>
                <th className="pb-3 font-medium text-right">Price (USD)</th>
                <th className="pb-3 font-medium text-right">Unit</th>
                <th className="pb-3 font-medium text-right">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {commodities.map((commodity) => (
                <tr key={commodity.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 font-medium text-gray-900 dark:text-white">{commodity.name}</td>
                  <td className="py-3">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">
                      {commodity.symbol}
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium text-gray-900 dark:text-white">
                    ${commodity.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right text-gray-500 dark:text-gray-400">/{commodity.unit}</td>
                  <td className={`py-3 text-right ${commodity.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {commodity.change >= 0 ? (
                        <ArrowTrendingUpIcon className="w-4 h-4" />
                      ) : (
                        <ArrowTrendingDownIcon className="w-4 h-4" />
                      )}
                      <span>{commodity.change >= 0 ? '+' : ''}{commodity.changePercent.toFixed(2)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Global News */}
      <Card>
        <SectionHeader 
          title="Global Financial News" 
          subtitle="Latest updates from international markets with sentiment"
          action={
            <a href="https://www.reuters.com/finance/" target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:text-primary-600">
              More news
            </a>
          }
        />
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {globalNews.map((item, index) => (
            <div key={index} className="py-4 first:pt-0 last:pb-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-4 px-4 py-2 rounded-lg transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    item.sentiment === 'positive' ? 'bg-green-500' : 
                    item.sentiment === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1 line-clamp-2">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{item.region}</span>
                      <span>•</span>
                      <span>
                        {new Date(item.publishedAt).toLocaleDateString('en-LK', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            </div>
          ))}
        </div>
      </Card>

      {/* Impact on Sri Lanka */}
      <Card>
        <SectionHeader title="Global Impact on Sri Lanka" subtitle="How global markets affect LKR and local investments" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">📈 US Fed Rate Impact</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              US rate changes affect USD/LKR exchange rate and foreign investment flows into Sri Lanka.
            </p>
          </div>
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">🛢️ Oil Price Sensitivity</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              As a net oil importer, global crude prices directly impact Sri Lanka's trade balance and inflation.
            </p>
          </div>
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">🥇 Gold as Safe Haven</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Gold remains a popular investment in Sri Lanka. Global gold prices affect local jewelry and bullion markets.
            </p>
          </div>
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
                These predictions are based on macroeconomic analysis, technical indicators, and market sentiment. 
                Global markets are highly volatile. This is not financial advice. Always consult a licensed advisor.
              </p>
            </div>
          </div>

          <Card>
            <SectionHeader title="Global Market Predictions" subtitle="AI-powered analysis of major world indices" />
            <div className="space-y-6">
              {marketPredictions.map((pred) => (
                <div key={pred.market} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{pred.flag}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{pred.market}</h3>
                        <p className="text-sm text-gray-500">Current: {pred.currentValue.toLocaleString()}</p>
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
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{pred.target1M.toLocaleString()}</p>
                      <p className={`text-sm ${pred.target1M > pred.currentValue ? 'text-green-500' : 'text-red-500'}`}>
                        {pred.target1M > pred.currentValue ? '+' : ''}{(((pred.target1M - pred.currentValue) / pred.currentValue) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">3 Month Target</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{pred.target3M.toLocaleString()}</p>
                      <p className={`text-sm ${pred.target3M > pred.currentValue ? 'text-green-500' : 'text-red-500'}`}>
                        {pred.target3M > pred.currentValue ? '+' : ''}{(((pred.target3M - pred.currentValue) / pred.currentValue) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">1 Year Target</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{pred.target1Y.toLocaleString()}</p>
                      <p className={`text-sm ${pred.target1Y > pred.currentValue ? 'text-green-500' : 'text-red-500'}`}>
                        {pred.target1Y > pred.currentValue ? '+' : ''}{(((pred.target1Y - pred.currentValue) / pred.currentValue) * 100).toFixed(1)}%
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

          {/* Currency & Commodity Outlook */}
          <Card>
            <SectionHeader title="Currency & Commodity Outlook" subtitle="Key trends for Sri Lankan investors" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">💱 USD/LKR Forecast</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Expected to remain stable at Rs. 320-330 range if IMF program continues on track. 
                  Fed rate cuts could strengthen LKR slightly.
                </p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">Stable Outlook</span>
                </div>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🪙 Gold Forecast</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Gold expected to test $2,100-2,200 levels in 2024. Good hedge against inflation and currency risk.
                  Consider 5-10% allocation.
                </p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs">Bullish</span>
                </div>
              </div>
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
              <h4 className="font-medium text-blue-800 dark:text-blue-200">Investing in Global Markets from Sri Lanka</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Sri Lankan investors can access global markets through licensed stockbrokers, unit trusts, and 
                approved offshore investment schemes. Always ensure compliance with CBSL forex regulations.
              </p>
            </div>
          </div>

          {/* Investment Strategies */}
          <Card>
            <SectionHeader title="Global Investment Strategies" subtitle="Approaches for Sri Lankan investors" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                  <GlobeAltIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Global Index ETFs</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Invest in broad market indices like S&P 500 or MSCI World through ETFs. Available via 
                  international brokers or local unit trusts with global exposure.
                </p>
                <div className="text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded inline-block">
                  ✓ Diversified & Low Cost
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <BanknotesIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">US Dollar Hedging</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Keep a portion of savings in USD-denominated assets to hedge against LKR depreciation.
                  Options include FD accounts at banks with USD facilities.
                </p>
                <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded inline-block">
                  ✓ Currency Protection
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                  <ChartBarIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Regional Diversification</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Don't put all eggs in one basket. Consider exposure to US, Europe, and emerging markets 
                  (especially India, given proximity and trading relationships).
                </p>
                <div className="text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded inline-block">
                  ✓ Risk Reduction
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheckIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Gold & Commodities</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Physical gold, sovereign gold bonds, or commodity ETFs can provide inflation protection
                  and portfolio diversification for Sri Lankan investors.
                </p>
                <div className="text-xs text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded inline-block">
                  ✓ Inflation Hedge
                </div>
              </div>
            </div>
          </Card>

          {/* Portfolio Allocation */}
          <Card>
            <SectionHeader title="Global Portfolio Allocation" subtitle="Recommended for Sri Lankan investors" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">🛡️ Conservative</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>Sri Lanka (CSE)</span><span className="font-medium">40%</span></li>
                  <li className="flex justify-between"><span>US Markets</span><span className="font-medium">20%</span></li>
                  <li className="flex justify-between"><span>Gold</span><span className="font-medium">15%</span></li>
                  <li className="flex justify-between"><span>USD Cash</span><span className="font-medium">15%</span></li>
                  <li className="flex justify-between"><span>Other Emerging</span><span className="font-medium">10%</span></li>
                </ul>
                <p className="mt-3 text-xs text-green-700 dark:text-green-300">Best for: Capital preservation</p>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3">⚖️ Balanced</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>Sri Lanka (CSE)</span><span className="font-medium">30%</span></li>
                  <li className="flex justify-between"><span>US Markets</span><span className="font-medium">30%</span></li>
                  <li className="flex justify-between"><span>Europe/Asia</span><span className="font-medium">15%</span></li>
                  <li className="flex justify-between"><span>Gold/Commodities</span><span className="font-medium">15%</span></li>
                  <li className="flex justify-between"><span>Cash Reserve</span><span className="font-medium">10%</span></li>
                </ul>
                <p className="mt-3 text-xs text-yellow-700 dark:text-yellow-300">Best for: Moderate growth</p>
              </div>

              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-3">🔥 Aggressive</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>US Tech/Growth</span><span className="font-medium">35%</span></li>
                  <li className="flex justify-between"><span>Sri Lanka (CSE)</span><span className="font-medium">25%</span></li>
                  <li className="flex justify-between"><span>Emerging Markets</span><span className="font-medium">20%</span></li>
                  <li className="flex justify-between"><span>Crypto</span><span className="font-medium">10%</span></li>
                  <li className="flex justify-between"><span>Gold/Commodities</span><span className="font-medium">10%</span></li>
                </ul>
                <p className="mt-3 text-xs text-red-700 dark:text-red-300">Best for: High risk tolerance</p>
              </div>
            </div>
          </Card>

          {/* How to Access Global Markets */}
          <Card>
            <SectionHeader title="How to Access Global Markets" subtitle="Step-by-step guide for Sri Lankans" />
            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold flex-shrink-0">1</div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Local Unit Trusts with Global Exposure</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Invest in SEC-approved unit trusts (e.g., NDB Wealth Global Fund, JB Vantage Global Fund) that invest in international markets. Easiest and most compliant method.</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold flex-shrink-0">2</div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Offshore Investment Accounts</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Some licensed banks offer offshore investment services. Ensure compliance with CBSL foreign exchange regulations and annual limits.</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold flex-shrink-0">3</div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">International Brokers (For eligible residents)</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sri Lankans living abroad or with foreign currency accounts can access platforms like Interactive Brokers, Charles Schwab, or local equivalents.</p>
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
                  <h4 className="font-medium text-gray-900 dark:text-white">Ignoring Currency Risk</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">USD gains can be eroded by LKR strengthening; factor in forex movements</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Overexposure to Single Market</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Don't put all money in US stocks; diversify across regions</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Ignoring Local Tax Implications</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Foreign investment income may be taxable in Sri Lanka; consult a tax advisor</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Using Unregulated Platforms</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Stick to SEC-approved and CBSL-compliant investment channels</p>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
