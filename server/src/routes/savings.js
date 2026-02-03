const express = require('express');
const { body, param } = require('express-validator');
const SavingsGoal = require('../models/SavingsGoal');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/savings
// @desc    Get all savings goals
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    
    const query = { user: req.userId };
    if (status !== 'all') {
      query.status = status;
    }
    
    const goals = await SavingsGoal.find(query).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: { goals }
    });
  } catch (error) {
    console.error('Get savings goals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch savings goals'
    });
  }
});

// @route   GET /api/savings/summary
// @desc    Get savings summary
// @access  Private
router.get('/summary', authenticate, async (req, res) => {
  try {
    const summary = await SavingsGoal.getSummary(req.userId);
    
    const activeGoals = await SavingsGoal.find({ 
      user: req.userId, 
      status: 'active' 
    });
    
    let totalTargetAmount = 0;
    let totalSavedAmount = 0;
    
    activeGoals.forEach(goal => {
      totalTargetAmount += goal.targetAmount;
      totalSavedAmount += goal.currentAmount;
    });
    
    res.json({
      success: true,
      data: {
        summary,
        activeGoalsCount: activeGoals.length,
        totalTargetAmount,
        totalSavedAmount,
        overallProgress: totalTargetAmount > 0 
          ? Math.round((totalSavedAmount / totalTargetAmount) * 100) 
          : 0
      }
    });
  } catch (error) {
    console.error('Get savings summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch savings summary'
    });
  }
});

// @route   GET /api/savings/:id
// @desc    Get single savings goal
// @access  Private
router.get('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid goal ID')
], validate, async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Savings goal not found'
      });
    }
    
    res.json({
      success: true,
      data: { goal }
    });
  } catch (error) {
    console.error('Get savings goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch savings goal'
    });
  }
});

// @route   POST /api/savings
// @desc    Create new savings goal
// @access  Private
router.post('/', authenticate, [
  body('name').trim().notEmpty().withMessage('Goal name is required'),
  body('targetAmount').isFloat({ min: 1 }).withMessage('Target amount must be at least 1'),
  body('targetDate').isISO8601().withMessage('Valid target date is required'),
  body('category').optional().isIn(['emergency_fund', 'vacation', 'home', 'car', 'education', 'wedding', 'retirement', 'investment', 'gadget', 'other'])
], validate, async (req, res) => {
  try {
    const goalData = {
      user: req.userId,
      name: req.body.name,
      description: req.body.description,
      targetAmount: req.body.targetAmount,
      currentAmount: req.body.currentAmount || 0,
      category: req.body.category || 'other',
      icon: req.body.icon || '🎯',
      color: req.body.color || '#3B82F6',
      targetDate: req.body.targetDate,
      priority: req.body.priority || 'medium',
      autoSave: req.body.autoSave,
      reminders: req.body.reminders
    };
    
    const goal = new SavingsGoal(goalData);
    await goal.save();
    
    res.status(201).json({
      success: true,
      message: 'Savings goal created successfully',
      data: { goal }
    });
  } catch (error) {
    console.error('Create savings goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create savings goal'
    });
  }
});

// @route   POST /api/savings/:id/contribute
// @desc    Add contribution to savings goal
// @access  Private
router.post('/:id/contribute', authenticate, [
  param('id').isMongoId().withMessage('Invalid goal ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Contribution amount must be greater than 0')
], validate, async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Savings goal not found'
      });
    }
    
    if (goal.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot contribute to a non-active goal'
      });
    }
    
    const contribution = {
      amount: req.body.amount,
      date: new Date(),
      note: req.body.note,
      isAutomatic: false
    };
    
    goal.contributions.push(contribution);
    goal.currentAmount += req.body.amount;
    
    await goal.save();
    
    res.json({
      success: true,
      message: 'Contribution added successfully',
      data: { 
        goal,
        newProgress: goal.progressPercentage
      }
    });
  } catch (error) {
    console.error('Add contribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add contribution'
    });
  }
});

// @route   PUT /api/savings/:id
// @desc    Update savings goal
// @access  Private
router.put('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid goal ID')
], validate, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'description', 'targetAmount', 'category', 'icon', 'color', 'targetDate', 'priority', 'autoSave', 'status', 'reminders'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    const goal = await SavingsGoal.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: updates },
      { new: true }
    );
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Savings goal not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Savings goal updated successfully',
      data: { goal }
    });
  } catch (error) {
    console.error('Update savings goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update savings goal'
    });
  }
});

// @route   DELETE /api/savings/:id
// @desc    Delete savings goal
// @access  Private
router.delete('/:id', authenticate, [
  param('id').isMongoId().withMessage('Invalid goal ID')
], validate, async (req, res) => {
  try {
    const goal = await SavingsGoal.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.userId 
    });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Savings goal not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Savings goal deleted successfully'
    });
  } catch (error) {
    console.error('Delete savings goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete savings goal'
    });
  }
});

module.exports = router;
