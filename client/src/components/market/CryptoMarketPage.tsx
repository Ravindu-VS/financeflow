import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionHeader, Button } from '../ui'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ArrowLeftIcon,
  SparklesIcon,
  ShieldCheckIcon,
  FireIcon,
  BoltIcon
} from '@heroicons/react/24/outline'

interface CryptoAsset {
  symbol: string
  name: string
  logo: string
  price: number
  change24h: number
  change7d: number
  marketCap: string
  volume24h: string
  circulatingSupply: string
  prediction: 'bullish' | 'bearish' | 'neutral'
  predictionScore: number
}

interface CryptoPrediction {
  symbol: string
  name: string
  currentPrice: number
  prediction1W: number
  prediction1M: number
  prediction3M: number
  sentiment: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish'
  confidence: number
  factors: string[]
}

interface CryptoNews {
  title: string
  source: string
  sentiment: 'positive' | 'negative' | 'neutral'
  publishedAt: string
}

export default function CryptoMarketPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'predictions' | 'advice'>('overview')

  useEffect(() => {
    setTimeout(() => setLoading(false), 500)
  }, [])

  // Top Cryptocurrencies
  const cryptoAssets: CryptoAsset[] = [
    { symbol: 'BTC', name: 'Bitcoin', logo: '₿', price: 43250.00, change24h: 2.45, change7d: 5.32, marketCap: '$847B', volume24h: '$28.5B', circulatingSupply: '19.6M BTC', prediction: 'bullish', predictionScore: 72 },
    { symbol: 'ETH', name: 'Ethereum', logo: 'Ξ', price: 2285.50, change24h: 3.12, change7d: 8.45, marketCap: '$274B', volume24h: '$15.2B', circulatingSupply: '120.2M ETH', prediction: 'bullish', predictionScore: 78 },
    { symbol: 'BNB', name: 'BNB', logo: '⬡', price: 312.45, change24h: 1.23, change7d: 3.67, marketCap: '$48B', volume24h: '$1.2B', circulatingSupply: '153.8M BNB', prediction: 'neutral', predictionScore: 55 },
    { symbol: 'SOL', name: 'Solana', logo: '◎', price: 98.75, change24h: 5.67, change7d: 12.34, marketCap: '$42B', volume24h: '$2.8B', circulatingSupply: '428M SOL', prediction: 'bullish', predictionScore: 81 },
    { symbol: 'XRP', name: 'XRP', logo: '✕', price: 0.62, change24h: -1.23, change7d: 2.45, marketCap: '$34B', volume24h: '$1.5B', circulatingSupply: '54.4B XRP', prediction: 'neutral', predictionScore: 48 },
    { symbol: 'ADA', name: 'Cardano', logo: '₳', price: 0.58, change24h: 2.34, change7d: 6.78, marketCap: '$20B', volume24h: '$580M', circulatingSupply: '35.4B ADA', prediction: 'bullish', predictionScore: 65 },
    { symbol: 'DOGE', name: 'Dogecoin', logo: 'Ð', price: 0.082, change24h: -2.45, change7d: -5.67, marketCap: '$11.6B', volume24h: '$450M', circulatingSupply: '142B DOGE', prediction: 'bearish', predictionScore: 35 },
    { symbol: 'DOT', name: 'Polkadot', logo: '●', price: 7.85, change24h: 1.89, change7d: 4.56, marketCap: '$10.2B', volume24h: '$320M', circulatingSupply: '1.3B DOT', prediction: 'neutral', predictionScore: 52 },
    { symbol: 'MATIC', name: 'Polygon', logo: '⬡', price: 0.92, change24h: 4.23, change7d: 9.87, marketCap: '$8.5B', volume24h: '$450M', circulatingSupply: '9.2B MATIC', prediction: 'bullish', predictionScore: 70 },
    { symbol: 'LINK', name: 'Chainlink', logo: '⬡', price: 15.45, change24h: 3.45, change7d: 7.89, marketCap: '$8.9B', volume24h: '$520M', circulatingSupply: '578M LINK', prediction: 'bullish', predictionScore: 74 },
  ]

  // Price Predictions
  const predictions: CryptoPrediction[] = [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      currentPrice: 43250.00,
      prediction1W: 44500,
      prediction1M: 48000,
      prediction3M: 55000,
      sentiment: 'bullish',
      confidence: 72,
      factors: ['Institutional adoption increasing', 'ETF approvals driving demand', 'Halving event approaching', 'Strong technical support']
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      currentPrice: 2285.50,
      prediction1W: 2400,
      prediction1M: 2800,
      prediction3M: 3500,
      sentiment: 'very_bullish',
      confidence: 78,
      factors: ['Layer 2 scaling adoption', 'DeFi TVL growth', 'ETH staking yields attractive', 'Network upgrades on track']
    },
    {
      symbol: 'SOL',
      name: 'Solana',
      currentPrice: 98.75,
      prediction1W: 105,
      prediction1M: 125,
      prediction3M: 150,
      sentiment: 'very_bullish',
      confidence: 75,
      factors: ['High transaction throughput', 'Growing ecosystem', 'NFT marketplace activity', 'Developer adoption']
    },
    {
      symbol: 'XRP',
      name: 'XRP',
      currentPrice: 0.62,
      prediction1W: 0.60,
      prediction1M: 0.65,
      prediction3M: 0.75,
      sentiment: 'neutral',
      confidence: 55,
      factors: ['SEC case developments', 'Cross-border payment adoption', 'Banking partnerships', 'Regulatory uncertainty']
    },
    {
      symbol: 'DOGE',
      name: 'Dogecoin',
      currentPrice: 0.082,
      prediction1W: 0.078,
      prediction1M: 0.075,
      prediction3M: 0.070,
      sentiment: 'bearish',
      confidence: 60,
      factors: ['Lack of utility development', 'Meme coin volatility', 'Competition from other tokens', 'Speculative nature']
    }
  ]

  // Market News
  const cryptoNews: CryptoNews[] = [
    { title: 'Bitcoin ETF sees record inflows as institutional demand surges', source: 'CoinDesk', sentiment: 'positive', publishedAt: '2024-01-15T14:00:00Z' },
    { title: 'Ethereum Layer 2 solutions process record transactions', source: 'The Block', sentiment: 'positive', publishedAt: '2024-01-15T12:30:00Z' },
    { title: 'Central banks explore CBDC integration with existing crypto rails', source: 'Reuters', sentiment: 'neutral', publishedAt: '2024-01-15T10:00:00Z' },
    { title: 'Regulatory clarity improves for crypto in major Asian markets', source: 'Bloomberg', sentiment: 'positive', publishedAt: '2024-01-14T18:00:00Z' },
    { title: 'DeFi protocols see increased adoption amid yield opportunities', source: 'CryptoSlate', sentiment: 'positive', publishedAt: '2024-01-14T15:00:00Z' }
  ]

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

  const formatLKR = (usd: number) => {
    const lkrRate = 323.45
    return `Rs. ${(usd * lkrRate).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crypto Market</h1>
          <p className="text-gray-500 dark:text-gray-400">Cryptocurrency prices, predictions & investment advice</p>
        </div>
        <div className="flex gap-2">
          <Link to="/market">
            <Button variant="outline" icon={<ArrowLeftIcon className="w-5 h-5" />}>
              CSE Market
            </Button>
          </Link>
          <Link to="/global-markets">
            <Button variant="outline" icon={<ChartBarIcon className="w-5 h-5" />}>
              Global Markets
            </Button>
          </Link>
        </div>
      </div>

      {/* Market Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <div className="text-3xl mb-2">₿</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Bitcoin</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">$43,250</p>
          <p className="text-sm text-green-500">+2.45%</p>
        </Card>
        <Card className="text-center">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Market Cap</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">$1.72T</p>
          <p className="text-sm text-green-500">+2.8%</p>
        </Card>
        <Card className="text-center">
          <div className="text-3xl mb-2">💹</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">24h Volume</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">$68.5B</p>
          <p className="text-sm text-green-500">+15.2%</p>
        </Card>
        <Card className="text-center">
          <div className="text-3xl mb-2">😨</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fear & Greed</p>
          <p className="text-lg font-bold text-green-500">72 - Greed</p>
          <p className="text-sm text-gray-400">Bullish sentiment</p>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <CurrencyDollarIcon className="w-4 h-4 inline-block mr-2" />
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
          <Card>
            <SectionHeader title="Top Cryptocurrencies" subtitle="Live prices and market data" />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Asset</th>
                    <th className="pb-3 font-medium text-right">Price (USD)</th>
                    <th className="pb-3 font-medium text-right">Price (LKR)</th>
                    <th className="pb-3 font-medium text-right">24h</th>
                    <th className="pb-3 font-medium text-right">7d</th>
                    <th className="pb-3 font-medium text-right">Market Cap</th>
                    <th className="pb-3 font-medium text-center">Outlook</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {cryptoAssets.map((crypto, index) => (
                    <tr key={crypto.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-4 text-gray-500">{index + 1}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{crypto.logo}</span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{crypto.name}</p>
                            <p className="text-sm text-gray-500">{crypto.symbol}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right font-medium text-gray-900 dark:text-white">
                        ${crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 text-right text-sm text-gray-500 dark:text-gray-400">
                        {formatLKR(crypto.price)}
                      </td>
                      <td className={`py-4 text-right ${crypto.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {crypto.change24h >= 0 ? (
                            <ArrowTrendingUpIcon className="w-4 h-4" />
                          ) : (
                            <ArrowTrendingDownIcon className="w-4 h-4" />
                          )}
                          {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(2)}%
                        </div>
                      </td>
                      <td className={`py-4 text-right ${crypto.change7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {crypto.change7d >= 0 ? '+' : ''}{crypto.change7d.toFixed(2)}%
                      </td>
                      <td className="py-4 text-right text-gray-500 dark:text-gray-400">{crypto.marketCap}</td>
                      <td className="py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPredictionBadge(crypto.prediction)}`}>
                          {crypto.prediction.charAt(0).toUpperCase() + crypto.prediction.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Crypto News */}
          <Card>
            <SectionHeader 
              title="Crypto News" 
              subtitle="Latest cryptocurrency market updates"
              action={
                <a href="https://www.coindesk.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:text-primary-600">
                  More news
                </a>
              }
            />
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {cryptoNews.map((item, index) => (
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
                These predictions are based on technical analysis and market sentiment. Cryptocurrency markets are highly volatile. 
                This is not financial advice. Always do your own research (DYOR) before investing.
              </p>
            </div>
          </div>

          <Card>
            <SectionHeader title="AI Price Predictions" subtitle="Based on technical analysis & market sentiment" />
            <div className="space-y-6">
              {predictions.map((pred) => (
                <div key={pred.symbol} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-yellow-500 flex items-center justify-center text-white font-bold text-lg">
                        {pred.symbol.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{pred.name} ({pred.symbol})</h3>
                        <p className="text-sm text-gray-500">Current: ${pred.currentPrice.toLocaleString()}</p>
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
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">1 Week</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">${pred.prediction1W.toLocaleString()}</p>
                      <p className={`text-sm ${pred.prediction1W > pred.currentPrice ? 'text-green-500' : 'text-red-500'}`}>
                        {pred.prediction1W > pred.currentPrice ? '+' : ''}{(((pred.prediction1W - pred.currentPrice) / pred.currentPrice) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">1 Month</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">${pred.prediction1M.toLocaleString()}</p>
                      <p className={`text-sm ${pred.prediction1M > pred.currentPrice ? 'text-green-500' : 'text-red-500'}`}>
                        {pred.prediction1M > pred.currentPrice ? '+' : ''}{(((pred.prediction1M - pred.currentPrice) / pred.currentPrice) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">3 Months</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">${pred.prediction3M.toLocaleString()}</p>
                      <p className={`text-sm ${pred.prediction3M > pred.currentPrice ? 'text-green-500' : 'text-red-500'}`}>
                        {pred.prediction3M > pred.currentPrice ? '+' : ''}{(((pred.prediction3M - pred.currentPrice) / pred.currentPrice) * 100).toFixed(1)}%
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
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800 dark:text-red-200">High Risk Investment</h4>
              <p className="text-sm text-red-700 dark:text-red-300">
                Cryptocurrency investments carry significant risk. Never invest more than you can afford to lose. 
                The crypto market can drop 50%+ in days. Consider your risk tolerance carefully.
              </p>
            </div>
          </div>

          {/* Investment Strategies */}
          <Card>
            <SectionHeader title="Investment Strategies" subtitle="Smart approaches for crypto investing" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Dollar Cost Averaging (DCA)</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Invest a fixed amount regularly (weekly/monthly) regardless of price. This reduces the impact of volatility 
                  and removes emotional decision-making.
                </p>
                <div className="text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded inline-block">
                  ✓ Recommended for beginners
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <ChartBarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Portfolio Diversification</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Don't put all your money in one crypto. Spread across Bitcoin (50-60%), Ethereum (20-30%), and altcoins (10-20%).
                </p>
                <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded inline-block">
                  ✓ Reduces overall risk
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                  <BoltIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">HODLing (Long-term)</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Buy and hold for 3-5+ years. Historically, Bitcoin has rewarded long-term holders despite short-term volatility.
                </p>
                <div className="text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded inline-block">
                  ✓ Best for major cryptos (BTC, ETH)
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-3">
                  <FireIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Take Profits Strategy</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Set profit targets (e.g., sell 20% at 2x, another 20% at 3x). This locks in gains and reduces risk of losing everything.
                </p>
                <div className="text-xs text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded inline-block">
                  ✓ Secures your gains
                </div>
              </div>
            </div>
          </Card>

          {/* Crypto Allocation by Risk */}
          <Card>
            <SectionHeader title="Recommended Allocation" subtitle="Based on your risk tolerance" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">🛡️ Conservative</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>Bitcoin (BTC)</span><span className="font-medium">70%</span></li>
                  <li className="flex justify-between"><span>Ethereum (ETH)</span><span className="font-medium">25%</span></li>
                  <li className="flex justify-between"><span>Stablecoins</span><span className="font-medium">5%</span></li>
                </ul>
                <p className="mt-3 text-xs text-green-700 dark:text-green-300">Best for: New investors, low risk tolerance</p>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3">⚖️ Balanced</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>Bitcoin (BTC)</span><span className="font-medium">50%</span></li>
                  <li className="flex justify-between"><span>Ethereum (ETH)</span><span className="font-medium">30%</span></li>
                  <li className="flex justify-between"><span>Top Altcoins</span><span className="font-medium">15%</span></li>
                  <li className="flex justify-between"><span>High Risk/High Reward</span><span className="font-medium">5%</span></li>
                </ul>
                <p className="mt-3 text-xs text-yellow-700 dark:text-yellow-300">Best for: Intermediate investors</p>
              </div>

              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-3">🔥 Aggressive</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>Bitcoin (BTC)</span><span className="font-medium">30%</span></li>
                  <li className="flex justify-between"><span>Ethereum (ETH)</span><span className="font-medium">25%</span></li>
                  <li className="flex justify-between"><span>Top Altcoins</span><span className="font-medium">30%</span></li>
                  <li className="flex justify-between"><span>Small Cap Gems</span><span className="font-medium">15%</span></li>
                </ul>
                <p className="mt-3 text-xs text-red-700 dark:text-red-300">Best for: Experienced traders only</p>
              </div>
            </div>
          </Card>

          {/* Sri Lankan Specific Advice */}
          <Card>
            <SectionHeader title="For Sri Lankan Investors" subtitle="Local considerations for crypto investing" />
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">🏦 How to Buy Crypto in Sri Lanka</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Use P2P platforms like Binance P2P, LocalBitcoins, or Paxful</li>
                  <li>• Payment via bank transfer (BOC, Sampath, Commercial Bank)</li>
                  <li>• Always verify seller ratings and use escrow protection</li>
                </ul>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">⚠️ Regulatory Notice</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Central Bank of Sri Lanka (CBSL) has not approved cryptocurrency</li>
                  <li>• No legal protection for crypto investments in Sri Lanka</li>
                  <li>• Keep records of all transactions for potential future tax requirements</li>
                </ul>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">💡 Tips for Sri Lankans</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Start small - don't invest your savings or emergency fund</li>
                  <li>• Consider crypto as 5-10% of your total investment portfolio maximum</li>
                  <li>• Use hardware wallets (Ledger, Trezor) for security</li>
                  <li>• Keep records in both USD and LKR for tracking</li>
                </ul>
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
                  <h4 className="font-medium text-gray-900 dark:text-white">FOMO Buying</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Buying when price is pumping due to fear of missing out</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Panic Selling</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Selling when market drops due to fear and panic</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">No Exit Strategy</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Not setting profit targets or stop-losses</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Investing Borrowed Money</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Using loans or credit cards to buy crypto</p>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
