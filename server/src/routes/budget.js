const express = require('express');
const { body, param } = require('express-validator');
const Budget = require('../models/Budget');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/budgets
// @desc    Get all budgets
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { active = 'true', period } = req.query;
    
    const query = { user: req.userId };
    if (active === 'true') query.isActive = true;
    if (period) query.period = period;
    
    const budgets = await Budget.find(query).sort({ category: 1 });
    
    res.json({
      success: true,
      data: { budgets }
    });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budgets'
    });
  }
});

// @route   GET /api/budgets/current
// @desc    Get current month's budgets
// @access  Private
router.get('/current', authenticate, async (req, res) => {
  try {
    const budgets = await Budget.getCurrentBudgets(req.userId);
    const summary = await Budget.getSummary(req.userId);
    
    res.json({
      success: true,
      data: { 
        budgets,
        summary
      }
    });
  } catch (error) {
    console.error('Get current budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current budgets'
    });
  }
});

// @route   GET /api/budgets/:id
// @desc    Get single budget
// @access  Private
router.get('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid budget ID')
], validate, async (req, res) => {
  try {
    const budget = await Budget.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }
    
    res.json({
      success: true,
      data: { budget }
    });
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget'
    });
  }
});

// @route   POST /api/budgets
// @desc    Create new budget
// @access  Private
router.post('/', authenticate, [
  body('category').isIn([
    'food', 'transport', 'bills', 'entertainment', 'shopping', 
    'education', 'healthcare', 'housing', 'insurance', 'personal',
    'travel', 'gifts', 'subscriptions', 'investments', 'savings', 'other', 'total'
  ]).withMessage('Invalid category'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be non-negative'),
  body('period').optional().isIn(['weekly', 'monthly', 'quarterly', 'yearly'])
], validate, async (req, res) => {
  try {
    const now = new Date();
    let startDate, endDate;
    
    const period = req.body.period || 'monthly';
    
    // Calculate period dates
    switch (period) {
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
    }
    
    // Check for existing budget in same category and period
    const existingBudget = await Budget.findOne({
      user: req.userId,
      category: req.body.category,
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
      isActive: true
    });
    
    if (existingBudget) {
      return res.status(400).json({
        success: false,
        message: 'A budget for this category already exists for this period'
      });
    }
    
    const budgetData = {
      user: req.userId,
      name: req.body.name || `${req.body.category} Budget`,
      category: req.body.category,
      amount: req.body.amount,
      period,
      startDate: req.body.startDate || startDate,
      endDate: req.body.endDate || endDate,
      color: req.body.color,
      icon: req.body.icon,
      alerts: req.body.alerts,
      rollover: req.body.rollover,
      notes: req.body.notes
    };
    
    const budget = new Budget(budgetData);
    await budget.save();
    
    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: { budget }
    });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create budget'
    });
  }
});

// @route   POST /api/budgets/bulk
// @desc    Create multiple budgets at once
// @access  Private
router.post('/bulk', authenticate, async (req, res) => {
  try {
    const { budgets, period = 'monthly' } = req.body;
    
    if (!Array.isArray(budgets) || budgets.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Budgets array is required'
      });
    }
    
    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const createdBudgets = [];
    
    for (const b of budgets) {
      const budgetData = {
        user: req.userId,
        name: b.name || `${b.category} Budget`,
        category: b.category,
        amount: b.amount,
        period,
        startDate,
        endDate,
        color: b.color,
        icon: b.icon
      };
      
      const budget = new Budget(budgetData);
      await budget.save();
      createdBudgets.push(budget);
    }
    
    res.status(201).json({
      success: true,
      message: `${createdBudgets.length} budgets created successfully`,
      data: { budgets: createdBudgets }
    });
  } catch (error) {
    console.error('Bulk create budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create budgets'
    });
  }
});

// @route   PUT /api/budgets/:id
// @desc    Update budget
// @access  Private
router.put('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid budget ID')
], validate, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'amount', 'color', 'icon', 'alerts', 'isActive', 'rollover', 'notes'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: updates },
      { new: true }
    );
    
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Budget updated successfully',
      data: { budget }
    });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update budget'
    });
  }
});

// @route   DELETE /api/budgets/:id
// @desc    Delete budget
// @access  Private
router.delete('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid budget ID')
], validate, async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete budget'
    });
  }
});

module.exports = router;
