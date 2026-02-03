const express = require('express');
const { body, param } = require('express-validator');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/expenses
// @desc    Get all expenses with pagination and filters
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category,
      paymentMethod,
      startDate, 
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;
    
    const query = { user: req.userId };
    
    // Filters
    if (category) query.category = category;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Expense.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        expenses,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses'
    });
  }
});

// @route   GET /api/expenses/summary
// @desc    Get expense summary
// @access  Private
router.get('/summary', authenticate, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
    
    const [total, byCategory, dailyExpenses, weekdayPattern, monthlyTrend] = await Promise.all([
      Expense.getTotalForPeriod(req.userId, startDate, endDate),
      Expense.getByCategory(req.userId, startDate, endDate),
      Expense.getDailyExpenses(req.userId, new Date().getFullYear(), new Date().getMonth() + 1),
      Expense.getWeekdayPattern(req.userId, 3),
      Expense.getMonthlyTrend(req.userId, 6)
    ]);
    
    res.json({
      success: true,
      data: {
        period,
        total: total.total,
        count: total.count,
        byCategory,
        dailyExpenses,
        weekdayPattern,
        monthlyTrend
      }
    });
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense summary'
    });
  }
});

// @route   GET /api/expenses/categories
// @desc    Get expense categories with totals
// @access  Private
router.get('/categories', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const categories = await Expense.getByCategory(req.userId, startOfMonth, endOfMonth);
    
    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// @route   GET /api/expenses/:id
// @desc    Get single expense
// @access  Private
router.get('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid expense ID')
], validate, async (req, res) => {
  try {
    const expense = await Expense.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }
    
    res.json({
      success: true,
      data: { expense }
    });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense'
    });
  }
});

// @route   POST /api/expenses
// @desc    Create new expense
// @access  Private
router.post('/', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('category').isIn([
    'food', 'transport', 'bills', 'entertainment', 'shopping', 
    'education', 'healthcare', 'housing', 'insurance', 'personal',
    'travel', 'gifts', 'subscriptions', 'investments', 'debt_payment', 'other'
  ]).withMessage('Invalid category'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('paymentMethod').optional().isIn(['cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer', 'wallet', 'other'])
], validate, async (req, res) => {
  try {
    const expenseData = {
      user: req.userId,
      amount: req.body.amount,
      category: req.body.category,
      subCategory: req.body.subCategory,
      description: req.body.description,
      date: req.body.date || new Date(),
      isRecurring: req.body.isRecurring || false,
      recurringDetails: req.body.recurringDetails,
      paymentMethod: req.body.paymentMethod || 'cash',
      merchant: req.body.merchant,
      tags: req.body.tags,
      isNecessary: req.body.isNecessary !== false
    };
    
    const expense = new Expense(expenseData);
    await expense.save();
    
    // Update budget spent amount
    await Budget.updateSpent(req.userId, expense.category, expense.amount);
    
    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: { expense }
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create expense'
    });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private
router.put('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid expense ID'),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('category').optional().isIn([
    'food', 'transport', 'bills', 'entertainment', 'shopping', 
    'education', 'healthcare', 'housing', 'insurance', 'personal',
    'travel', 'gifts', 'subscriptions', 'investments', 'debt_payment', 'other'
  ])
], validate, async (req, res) => {
  try {
    const oldExpense = await Expense.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!oldExpense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }
    
    const allowedUpdates = ['amount', 'category', 'subCategory', 'description', 'date', 'isRecurring', 'recurringDetails', 'paymentMethod', 'merchant', 'tags', 'isNecessary', 'sentiment'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    
    // Update budget if amount or category changed
    if (updates.amount || updates.category) {
      // Reverse old expense from budget
      if (oldExpense.category) {
        await Budget.updateSpent(req.userId, oldExpense.category, -oldExpense.amount);
      }
      // Add new expense to budget
      await Budget.updateSpent(req.userId, expense.category, expense.amount);
    }
    
    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: { expense }
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense'
    });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid expense ID')
], validate, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }
    
    // Update budget
    await Budget.updateSpent(req.userId, expense.category, -expense.amount);
    
    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense'
    });
  }
});

module.exports = router;
