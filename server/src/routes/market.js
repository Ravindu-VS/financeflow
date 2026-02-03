const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Simulated market data (In production, integrate with real APIs like Alpha Vantage, Yahoo Finance)
const marketData = {
  indices: [
    { name: 'NIFTY 50', value: 21850, change: 0.45, trend: 'up' },
    { name: 'SENSEX', value: 72150, change: 0.38, trend: 'up' },
    { name: 'NIFTY Bank', value: 46200, change: -0.22, trend: 'down' },
    { name: 'NIFTY IT', value: 38500, change: 1.2, trend: 'up' }
  ],
  sectors: [
    { name: 'Technology', trend: 'bullish', recommendation: 'Long-term buy', risk: 'medium' },
    { name: 'Banking', trend: 'neutral', recommendation: 'Hold', risk: 'medium' },
    { name: 'Healthcare', trend: 'bullish', recommendation: 'Buy', risk: 'low' },
    { name: 'Energy', trend: 'bearish', recommendation: 'Cautious', risk: 'high' },
    { name: 'Consumer Goods', trend: 'neutral', recommendation: 'Hold', risk: 'low' },
    { name: 'Real Estate', trend: 'bullish', recommendation: 'Selective buy', risk: 'medium' }
  ],
  sentiment: {
    overall: 'bullish',
    confidence: 65,
    factors: [
      'Strong corporate earnings',
      'Positive FII inflows',
      'Stable interest rate outlook',
      'Global market recovery'
    ]
  }
};

// Educational investment content
const educationalContent = [
  {
    id: 1,
    title: 'Understanding Mutual Funds',
    category: 'mutual_funds',
    summary: 'Learn about different types of mutual funds and how to choose the right one for your goals.',
    readTime: 5,
    difficulty: 'beginner'
  },
  {
    id: 2,
    title: 'Stock Market Basics',
    category: 'stocks',
    summary: 'An introduction to stock markets, how they work, and key terms you should know.',
    readTime: 8,
    difficulty: 'beginner'
  },
  {
    id: 3,
    title: 'Building a Diversified Portfolio',
    category: 'portfolio',
    summary: 'Learn the importance of diversification and how to spread your investments across asset classes.',
    readTime: 6,
    difficulty: 'intermediate'
  },
  {
    id: 4,
    title: 'Understanding Fixed Deposits',
    category: 'fixed_deposit',
    summary: 'A safe investment option with guaranteed returns. Learn about FD rates and strategies.',
    readTime: 4,
    difficulty: 'beginner'
  },
  {
    id: 5,
    title: 'Gold as an Investment',
    category: 'gold',
    summary: 'Explore different ways to invest in gold and its role in portfolio hedging.',
    readTime: 5,
    difficulty: 'beginner'
  },
  {
    id: 6,
    title: 'Tax-Saving Investment Options',
    category: 'tax',
    summary: 'Learn about Section 80C investments and how to save tax while building wealth.',
    readTime: 7,
    difficulty: 'intermediate'
  },
  {
    id: 7,
    title: 'Risk Management in Investing',
    category: 'risk',
    summary: 'Understanding and managing investment risks for better long-term returns.',
    readTime: 8,
    difficulty: 'intermediate'
  },
  {
    id: 8,
    title: 'SIP vs Lump Sum Investment',
    category: 'strategy',
    summary: 'Compare systematic investment plans with one-time investments and choose what suits you.',
    readTime: 5,
    difficulty: 'beginner'
  }
];

// @route   GET /api/market/overview
// @desc    Get market overview
// @access  Public (with optional auth for personalized data)
router.get('/overview', optionalAuth, async (req, res) => {
  try {
    // In production, fetch real-time data from market APIs
    const overview = {
      indices: marketData.indices,
      sentiment: marketData.sentiment,
      lastUpdated: new Date().toISOString(),
      disclaimer: 'Market data may be delayed. This is for informational purposes only.'
    };
    
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Get market overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market overview'
    });
  }
});

// @route   GET /api/market/sectors
// @desc    Get sector analysis
// @access  Public
router.get('/sectors', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        sectors: marketData.sectors,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get sectors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sector data'
    });
  }
});

// @route   GET /api/market/sentiment
// @desc    Get market sentiment
// @access  Public
router.get('/sentiment', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        sentiment: marketData.sentiment,
        explanation: getSentimentExplanation(marketData.sentiment.overall),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get sentiment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market sentiment'
    });
  }
});

// @route   GET /api/market/education
// @desc    Get educational content
// @access  Public
router.get('/education', async (req, res) => {
  try {
    const { category, difficulty } = req.query;
    
    let content = [...educationalContent];
    
    if (category) {
      content = content.filter(c => c.category === category);
    }
    if (difficulty) {
      content = content.filter(c => c.difficulty === difficulty);
    }
    
    res.json({
      success: true,
      data: { content }
    });
  } catch (error) {
    console.error('Get education content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch educational content'
    });
  }
});

// @route   GET /api/market/recommendations
// @desc    Get personalized market recommendations
// @access  Private
router.get('/recommendations', authenticate, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId);
    const riskProfile = user.financialSetup?.riskProfile || 'medium';
    
    const recommendations = getRecommendationsByRisk(riskProfile);
    
    res.json({
      success: true,
      data: {
        riskProfile,
        recommendations,
        disclaimer: 'These recommendations are for educational purposes only and do not constitute financial advice.'
      }
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendations'
    });
  }
});

// Helper functions
function getSentimentExplanation(sentiment) {
  const explanations = {
    bullish: 'Markets are showing positive momentum with strong buying interest. This could be a good time for long-term investments.',
    bearish: 'Markets are experiencing selling pressure. Consider defensive positions and avoid aggressive investments.',
    neutral: 'Markets are consolidating with mixed signals. Wait for clearer trends before making major investment decisions.'
  };
  return explanations[sentiment] || explanations.neutral;
}

function getRecommendationsByRisk(riskProfile) {
  const recommendations = {
    low: {
      allocation: {
        'Fixed Deposits': 40,
        'Government Bonds': 25,
        'Blue-chip Stocks': 15,
        'Gold': 10,
        'Debt Mutual Funds': 10
      },
      suggestions: [
        'Focus on capital preservation with FDs and bonds',
        'Consider PPF for tax-saving and safe returns',
        'Limit stock exposure to large-cap companies',
        'Keep 6 months emergency fund in liquid assets'
      ]
    },
    medium: {
      allocation: {
        'Mutual Funds': 35,
        'Stocks': 25,
        'Fixed Deposits': 20,
        'Gold': 10,
        'Others': 10
      },
      suggestions: [
        'Diversify across equity and debt mutual funds',
        'Consider SIP for regular investing',
        'Mix of large-cap and mid-cap stocks',
        'Review and rebalance portfolio quarterly'
      ]
    },
    high: {
      allocation: {
        'Stocks': 45,
        'Equity Mutual Funds': 25,
        'Small/Mid-cap': 15,
        'Alternative Investments': 10,
        'Gold': 5
      },
      suggestions: [
        'Aggressive equity exposure for higher returns',
        'Consider sector-specific and thematic funds',
        'Explore small-cap opportunities with research',
        'Maintain long-term horizon of 7+ years'
      ]
    }
  };
  
  return recommendations[riskProfile] || recommendations.medium;
}

module.exports = router;
