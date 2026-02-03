const express = require('express');
const { authenticate } = require('../middleware/auth');
const { FinancialInsightsEngine } = require('../services/insightsEngine');

const router = express.Router();

// @route   GET /api/insights/predictions
// @desc    Get financial predictions
// @access  Private
router.get('/predictions', authenticate, async (req, res) => {
  try {
    const engine = new FinancialInsightsEngine(req.userId);
    const predictions = await engine.generatePredictions();
    
    res.json({
      success: true,
      data: {
        predictions,
        disclaimer: 'These predictions are based on historical data and patterns. Actual results may vary.'
      }
    });
  } catch (error) {
    console.error('Get predictions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate predictions'
    });
  }
});

// @route   GET /api/insights/suggestions
// @desc    Get money-saving suggestions
// @access  Private
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const engine = new FinancialInsightsEngine(req.userId);
    const suggestions = await engine.generateSavingSuggestions();
    
    res.json({
      success: true,
      data: { suggestions }
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate suggestions'
    });
  }
});

// @route   GET /api/insights/investment-recommendations
// @desc    Get investment recommendations
// @access  Private
router.get('/investment-recommendations', authenticate, async (req, res) => {
  try {
    const engine = new FinancialInsightsEngine(req.userId);
    const recommendations = await engine.generateInvestmentRecommendations();
    
    res.json({
      success: true,
      data: {
        recommendations,
        disclaimer: 'Investment suggestions are educational only, not financial advice. Please consult a qualified financial advisor before making investment decisions.'
      }
    });
  } catch (error) {
    console.error('Get investment recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate investment recommendations'
    });
  }
});

// @route   GET /api/insights/behavioral
// @desc    Get behavioral insights
// @access  Private
router.get('/behavioral', authenticate, async (req, res) => {
  try {
    const engine = new FinancialInsightsEngine(req.userId);
    const insights = await engine.analyzeBehavior();
    
    res.json({
      success: true,
      data: { insights }
    });
  } catch (error) {
    console.error('Get behavioral insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate behavioral insights'
    });
  }
});

// @route   GET /api/insights/financial-health
// @desc    Get overall financial health score
// @access  Private
router.get('/financial-health', authenticate, async (req, res) => {
  try {
    const engine = new FinancialInsightsEngine(req.userId);
    const health = await engine.calculateFinancialHealth();
    
    res.json({
      success: true,
      data: { health }
    });
  } catch (error) {
    console.error('Get financial health error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate financial health'
    });
  }
});

// @route   GET /api/insights/all
// @desc    Get all insights at once
// @access  Private
router.get('/all', authenticate, async (req, res) => {
  try {
    const engine = new FinancialInsightsEngine(req.userId);
    
    const [predictions, suggestions, investmentRecs, behavioral, health] = await Promise.all([
      engine.generatePredictions(),
      engine.generateSavingSuggestions(),
      engine.generateInvestmentRecommendations(),
      engine.analyzeBehavior(),
      engine.calculateFinancialHealth()
    ]);
    
    res.json({
      success: true,
      data: {
        predictions,
        suggestions,
        investmentRecommendations: investmentRecs,
        behavioral,
        financialHealth: health,
        disclaimer: 'All insights and recommendations are educational only and based on your historical data. This is not financial advice.'
      }
    });
  } catch (error) {
    console.error('Get all insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate insights'
    });
  }
});

module.exports = router;
