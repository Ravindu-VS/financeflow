const express = require('express');
const { body, param } = require('express-validator');
const Investment = require('../models/Investment');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/investments
// @desc    Get all investments
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, status = 'active' } = req.query;
    
    const query = { user: req.userId };
    if (type) query.type = type;
    if (status !== 'all') query.status = status;
    
    const investments = await Investment.find(query).sort({ currentValue: -1 });
    
    res.json({
      success: true,
      data: { investments }
    });
  } catch (error) {
    console.error('Get investments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch investments'
    });
  }
});

// @route   GET /api/investments/portfolio
// @desc    Get portfolio summary
// @access  Private
router.get('/portfolio', authenticate, async (req, res) => {
  try {
    const [portfolioByType, overallStats] = await Promise.all([
      Investment.getPortfolioSummary(req.userId),
      Investment.getOverallStats(req.userId)
    ]);
    
    // Calculate allocation percentages
    const totalValue = overallStats.totalCurrentValue || 0;
    const allocation = portfolioByType.map(item => ({
      ...item,
      percentage: totalValue > 0 ? Math.round((item.totalCurrentValue / totalValue) * 100) : 0
    }));
    
    res.json({
      success: true,
      data: {
        overall: overallStats,
        allocation,
        portfolioByType
      }
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio'
    });
  }
});

// @route   GET /api/investments/:id
// @desc    Get single investment
// @access  Private
router.get('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid investment ID')
], validate, async (req, res) => {
  try {
    const investment = await Investment.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found'
      });
    }
    
    res.json({
      success: true,
      data: { investment }
    });
  } catch (error) {
    console.error('Get investment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch investment'
    });
  }
});

// @route   POST /api/investments
// @desc    Create new investment
// @access  Private
router.post('/', authenticate, [
  body('name').trim().notEmpty().withMessage('Investment name is required'),
  body('type').isIn(['stocks', 'mutual_funds', 'fixed_deposit', 'crypto', 'gold', 'real_estate', 'bonds', 'etf', 'ppf', 'nps', 'other']).withMessage('Invalid investment type'),
  body('investedAmount').isFloat({ min: 0 }).withMessage('Invested amount must be non-negative'),
  body('purchasePrice').isFloat({ min: 0 }).withMessage('Purchase price must be non-negative'),
  body('purchaseDate').isISO8601().withMessage('Valid purchase date is required')
], validate, async (req, res) => {
  try {
    const investmentData = {
      user: req.userId,
      name: req.body.name,
      type: req.body.type,
      symbol: req.body.symbol,
      platform: req.body.platform,
      investedAmount: req.body.investedAmount,
      currentValue: req.body.currentValue || req.body.investedAmount,
      units: req.body.units || 1,
      purchasePrice: req.body.purchasePrice,
      currentPrice: req.body.currentPrice || req.body.purchasePrice,
      purchaseDate: req.body.purchaseDate,
      maturityDate: req.body.maturityDate,
      interestRate: req.body.interestRate,
      riskLevel: req.body.riskLevel || 'medium',
      notes: req.body.notes,
      tags: req.body.tags
    };
    
    // Add initial transaction
    investmentData.transactions = [{
      type: 'buy',
      amount: req.body.investedAmount,
      units: req.body.units || 1,
      price: req.body.purchasePrice,
      date: req.body.purchaseDate
    }];
    
    const investment = new Investment(investmentData);
    await investment.save();
    
    res.status(201).json({
      success: true,
      message: 'Investment created successfully',
      data: { investment }
    });
  } catch (error) {
    console.error('Create investment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create investment'
    });
  }
});

// @route   POST /api/investments/:id/transaction
// @desc    Add transaction to investment
// @access  Private
router.post('/:id/transaction', authenticate, [
  param('id').isMongoId().withMessage('Invalid investment ID'),
  body('type').isIn(['buy', 'sell', 'dividend', 'split', 'bonus']).withMessage('Invalid transaction type'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be non-negative')
], validate, async (req, res) => {
  try {
    const investment = await Investment.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found'
      });
    }
    
    const transaction = {
      type: req.body.type,
      amount: req.body.amount,
      units: req.body.units,
      price: req.body.price,
      date: req.body.date || new Date(),
      notes: req.body.notes
    };
    
    investment.transactions.push(transaction);
    
    // Update investment based on transaction type
    if (req.body.type === 'buy') {
      investment.investedAmount += req.body.amount;
      investment.units += req.body.units || 0;
    } else if (req.body.type === 'sell') {
      investment.units -= req.body.units || 0;
      if (investment.units <= 0) {
        investment.status = 'sold';
        investment.soldDetails = {
          soldDate: new Date(),
          soldPrice: req.body.price,
          soldUnits: req.body.units,
          realizedGain: req.body.amount - investment.investedAmount
        };
      }
    } else if (req.body.type === 'dividend') {
      investment.dividends.push({
        amount: req.body.amount,
        date: req.body.date || new Date(),
        reinvested: req.body.reinvested || false
      });
    }
    
    await investment.save();
    
    res.json({
      success: true,
      message: 'Transaction added successfully',
      data: { investment }
    });
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add transaction'
    });
  }
});

// @route   PUT /api/investments/:id
// @desc    Update investment
// @access  Private
router.put('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid investment ID')
], validate, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'symbol', 'platform', 'currentValue', 'currentPrice', 'maturityDate', 'interestRate', 'riskLevel', 'status', 'notes', 'tags'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    // Update lastUpdated
    updates.lastUpdated = new Date();
    
    const investment = await Investment.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: updates },
      { new: true }
    );
    
    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Investment updated successfully',
      data: { investment }
    });
  } catch (error) {
    console.error('Update investment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update investment'
    });
  }
});

// @route   PUT /api/investments/:id/price
// @desc    Update current price
// @access  Private
router.put('/:id/price', authenticate, [
  param('id').isMongoId().withMessage('Invalid investment ID'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be non-negative')
], validate, async (req, res) => {
  try {
    const investment = await Investment.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found'
      });
    }
    
    // Add to price history
    investment.priceHistory.push({
      price: req.body.price,
      date: new Date()
    });
    
    investment.currentPrice = req.body.price;
    investment.currentValue = req.body.price * investment.units;
    investment.lastUpdated = new Date();
    
    await investment.save();
    
    res.json({
      success: true,
      message: 'Price updated successfully',
      data: { investment }
    });
  } catch (error) {
    console.error('Update price error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update price'
    });
  }
});

// @route   DELETE /api/investments/:id
// @desc    Delete investment
// @access  Private
router.delete('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid investment ID')
], validate, async (req, res) => {
  try {
    const investment = await Investment.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!investment) {
      return res.status(404).json({
        success: false,
        message: 'Investment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Investment deleted successfully'
    });
  } catch (error) {
    console.error('Delete investment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete investment'
    });
  }
});

module.exports = router;
