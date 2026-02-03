const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/user/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    res.json({
      success: true,
      data: {
        profile: user.profile,
        email: user.email,
        financialSetup: user.financialSetup,
        preferences: user.preferences,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim(),
  body('phone').optional().trim()
], validate, async (req, res) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    
    const updateData = {};
    if (firstName) updateData['profile.firstName'] = firstName;
    if (lastName !== undefined) updateData['profile.lastName'] = lastName;
    if (phone !== undefined) updateData['profile.phone'] = phone;
    if (avatar !== undefined) updateData['profile.avatar'] = avatar;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { profile: user.profile }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// @route   PUT /api/user/financial-setup
// @desc    Update financial setup
// @access  Private
router.put('/financial-setup', authenticate, [
  body('currency').optional().isIn(['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']),
  body('monthlyIncome').optional().isNumeric().withMessage('Monthly income must be a number'),
  body('riskProfile').optional().isIn(['low', 'medium', 'high']),
  body('financialGoals').optional().isArray()
], validate, async (req, res) => {
  try {
    const { currency, monthlyIncome, riskProfile, financialGoals } = req.body;
    
    const updateData = {};
    if (currency) updateData['financialSetup.currency'] = currency;
    if (monthlyIncome !== undefined) updateData['financialSetup.monthlyIncome'] = monthlyIncome;
    if (riskProfile) updateData['financialSetup.riskProfile'] = riskProfile;
    if (financialGoals) updateData['financialSetup.financialGoals'] = financialGoals;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Financial setup updated successfully',
      data: { financialSetup: user.financialSetup }
    });
  } catch (error) {
    console.error('Update financial setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update financial setup'
    });
  }
});

// @route   PUT /api/user/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', authenticate, async (req, res) => {
  try {
    const { theme, notifications, dashboardLayout } = req.body;
    
    const updateData = {};
    if (theme) updateData['preferences.theme'] = theme;
    if (notifications) {
      Object.keys(notifications).forEach(key => {
        updateData[`preferences.notifications.${key}`] = notifications[key];
      });
    }
    if (dashboardLayout) updateData['preferences.dashboardLayout'] = dashboardLayout;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: user.preferences }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
});

// @route   DELETE /api/user/account
// @desc    Deactivate user account
// @access  Private
router.delete('/account', authenticate, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { isActive: false });
    
    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate account'
    });
  }
});

// @route   GET /api/user/dashboard-summary
// @desc    Get dashboard summary data
// @access  Private
router.get('/dashboard-summary', authenticate, async (req, res) => {
  try {
    const Income = require('../models/Income');
    const Expense = require('../models/Expense');
    const SavingsGoal = require('../models/SavingsGoal');
    const Investment = require('../models/Investment');
    const Budget = require('../models/Budget');
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Get totals for current month
    const [income, expenses, savings, investments, budgetSummary] = await Promise.all([
      Income.getTotalForPeriod(req.userId, startOfMonth, endOfMonth),
      Expense.getTotalForPeriod(req.userId, startOfMonth, endOfMonth),
      SavingsGoal.getSummary(req.userId),
      Investment.getOverallStats(req.userId),
      Budget.getSummary(req.userId)
    ]);
    
    // Calculate current balance
    const currentBalance = income.total - expenses.total;
    
    // Get active savings goals
    const activeGoals = await SavingsGoal.find({ 
      user: req.userId, 
      status: 'active' 
    }).limit(3);
    
    res.json({
      success: true,
      data: {
        currentBalance,
        monthlyIncome: income.total,
        monthlyExpenses: expenses.total,
        savingsProgress: savings,
        investments: investments,
        budget: budgetSummary,
        activeGoals: activeGoals.map(g => ({
          id: g._id,
          name: g.name,
          progress: g.progressPercentage,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount
        })),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard summary'
    });
  }
});

module.exports = router;
