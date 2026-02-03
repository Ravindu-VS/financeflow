const express = require('express');
const { body, query, param } = require('express-validator');
const Income = require('../models/Income');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/income
// @desc    Get all income entries with pagination and filters
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      source, 
      startDate, 
      endDate,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;
    
    const query = { user: req.userId };
    
    // Filters
    if (source) query.source = source;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [incomes, total] = await Promise.all([
      Income.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Income.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        incomes,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get incomes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income entries'
    });
  }
});

// @route   GET /api/income/summary
// @desc    Get income summary for current month
// @access  Private
router.get('/summary', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const [total, bySource, monthlyTrend] = await Promise.all([
      Income.getTotalForPeriod(req.userId, startOfMonth, endOfMonth),
      Income.getBySource(req.userId, startOfMonth, endOfMonth),
      Income.getMonthlyTrend(req.userId, 6)
    ]);
    
    res.json({
      success: true,
      data: {
        currentMonth: {
          total: total.total,
          count: total.count
        },
        bySource,
        monthlyTrend
      }
    });
  } catch (error) {
    console.error('Get income summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income summary'
    });
  }
});

// @route   GET /api/income/:id
// @desc    Get single income entry
// @access  Private
router.get('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid income ID')
], validate, async (req, res) => {
  try {
    const income = await Income.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!income) {
      return res.status(404).json({
        success: false,
        message: 'Income entry not found'
      });
    }
    
    res.json({
      success: true,
      data: { income }
    });
  } catch (error) {
    console.error('Get income error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income entry'
    });
  }
});

// @route   POST /api/income
// @desc    Create new income entry
// @access  Private
router.post('/', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('source').isIn(['salary', 'freelance', 'business', 'passive', 'investment', 'rental', 'bonus', 'gift', 'refund', 'other']).withMessage('Invalid income source'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('isRecurring').optional().isBoolean()
], validate, async (req, res) => {
  try {
    const incomeData = {
      user: req.userId,
      amount: req.body.amount,
      source: req.body.source,
      category: req.body.category || 'general',
      description: req.body.description,
      date: req.body.date || new Date(),
      isRecurring: req.body.isRecurring || false,
      recurringDetails: req.body.recurringDetails,
      tags: req.body.tags,
      metadata: req.body.metadata
    };
    
    const income = new Income(incomeData);
    await income.save();
    
    res.status(201).json({
      success: true,
      message: 'Income entry created successfully',
      data: { income }
    });
  } catch (error) {
    console.error('Create income error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create income entry'
    });
  }
});

// @route   PUT /api/income/:id
// @desc    Update income entry
// @access  Private
router.put('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid income ID'),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('source').optional().isIn(['salary', 'freelance', 'business', 'passive', 'investment', 'rental', 'bonus', 'gift', 'refund', 'other'])
], validate, async (req, res) => {
  try {
    const allowedUpdates = ['amount', 'source', 'category', 'description', 'date', 'isRecurring', 'recurringDetails', 'tags', 'metadata', 'isVerified'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    const income = await Income.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: updates },
      { new: true }
    );
    
    if (!income) {
      return res.status(404).json({
        success: false,
        message: 'Income entry not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Income entry updated successfully',
      data: { income }
    });
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update income entry'
    });
  }
});

// @route   DELETE /api/income/:id
// @desc    Delete income entry
// @access  Private
router.delete('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid income ID')
], validate, async (req, res) => {
  try {
    const income = await Income.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!income) {
      return res.status(404).json({
        success: false,
        message: 'Income entry not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Income entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete income error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete income entry'
    });
  }
});

module.exports = router;
