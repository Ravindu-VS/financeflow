const express = require('express');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const SavingsGoal = require('../models/SavingsGoal');
const Investment = require('../models/Investment');
const Budget = require('../models/Budget');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/analytics/overview
// @desc    Get financial overview
// @access  Private
router.get('/overview', authenticate, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate, endDate, prevStartDate, prevEndDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 7);
        prevEndDate = new Date(startDate);
        prevEndDate.setSeconds(prevEndDate.getSeconds() - 1);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
        prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }
    
    // Get current period data
    const [currentIncome, currentExpenses, prevIncome, prevExpenses] = await Promise.all([
      Income.getTotalForPeriod(req.userId, startDate, endDate),
      Expense.getTotalForPeriod(req.userId, startDate, endDate),
      Income.getTotalForPeriod(req.userId, prevStartDate, prevEndDate),
      Expense.getTotalForPeriod(req.userId, prevStartDate, prevEndDate)
    ]);
    
    // Calculate changes
    const incomeChange = prevIncome.total > 0 
      ? ((currentIncome.total - prevIncome.total) / prevIncome.total) * 100 
      : 0;
    const expenseChange = prevExpenses.total > 0 
      ? ((currentExpenses.total - prevExpenses.total) / prevExpenses.total) * 100 
      : 0;
    
    const netSavings = currentIncome.total - currentExpenses.total;
    const savingsRate = currentIncome.total > 0 
      ? (netSavings / currentIncome.total) * 100 
      : 0;
    
    res.json({
      success: true,
      data: {
        period,
        current: {
          income: currentIncome.total,
          expenses: currentExpenses.total,
          netSavings,
          savingsRate: Math.round(savingsRate * 10) / 10
        },
        previous: {
          income: prevIncome.total,
          expenses: prevExpenses.total
        },
        changes: {
          income: Math.round(incomeChange * 10) / 10,
          expenses: Math.round(expenseChange * 10) / 10
        }
      }
    });
  } catch (error) {
    console.error('Get analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics overview'
    });
  }
});

// @route   GET /api/analytics/income-vs-expense
// @desc    Get income vs expense comparison
// @access  Private
router.get('/income-vs-expense', authenticate, async (req, res) => {
  try {
    const { months = 6 } = req.query;
    
    const [incomeTrend, expenseTrend] = await Promise.all([
      Income.getMonthlyTrend(req.userId, parseInt(months)),
      Expense.getMonthlyTrend(req.userId, parseInt(months))
    ]);
    
    // Merge data
    const monthlyData = {};
    
    incomeTrend.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      monthlyData[key] = {
        year: item._id.year,
        month: item._id.month,
        income: item.total,
        expenses: 0
      };
    });
    
    expenseTrend.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      if (monthlyData[key]) {
        monthlyData[key].expenses = item.total;
      } else {
        monthlyData[key] = {
          year: item._id.year,
          month: item._id.month,
          income: 0,
          expenses: item.total
        };
      }
    });
    
    // Convert to sorted array
    const data = Object.values(monthlyData)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
      .map(item => ({
        ...item,
        netSavings: item.income - item.expenses,
        monthName: new Date(item.year, item.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }));
    
    res.json({
      success: true,
      data: { monthlyComparison: data }
    });
  } catch (error) {
    console.error('Get income vs expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch income vs expense data'
    });
  }
});

// @route   GET /api/analytics/expense-breakdown
// @desc    Get expense breakdown by category
// @access  Private
router.get('/expense-breakdown', authenticate, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
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
    
    const breakdown = await Expense.getByCategory(req.userId, startDate, endDate);
    
    // Calculate percentages
    const total = breakdown.reduce((sum, cat) => sum + cat.total, 0);
    const data = breakdown.map(cat => ({
      category: cat._id,
      total: cat.total,
      count: cat.count,
      average: Math.round(cat.avgAmount),
      percentage: total > 0 ? Math.round((cat.total / total) * 100) : 0
    }));
    
    res.json({
      success: true,
      data: {
        breakdown: data,
        totalExpenses: total
      }
    });
  } catch (error) {
    console.error('Get expense breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense breakdown'
    });
  }
});

// @route   GET /api/analytics/spending-patterns
// @desc    Get spending patterns analysis
// @access  Private
router.get('/spending-patterns', authenticate, async (req, res) => {
  try {
    const [weekdayPattern, dailyExpenses] = await Promise.all([
      Expense.getWeekdayPattern(req.userId, 3),
      Expense.getDailyExpenses(req.userId, new Date().getFullYear(), new Date().getMonth() + 1)
    ]);
    
    // Map weekday numbers to names
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayData = weekdayPattern.map(item => ({
      day: weekdays[item._id - 1],
      dayNumber: item._id,
      total: item.total,
      average: Math.round(item.avgAmount),
      count: item.count
    }));
    
    // Identify high spending days
    const avgDaily = weekdayData.reduce((sum, d) => sum + d.average, 0) / weekdayData.length;
    const highSpendingDays = weekdayData.filter(d => d.average > avgDaily * 1.2);
    
    res.json({
      success: true,
      data: {
        weekdayPattern: weekdayData,
        dailyExpenses,
        insights: {
          averageDailySpend: Math.round(avgDaily),
          highSpendingDays: highSpendingDays.map(d => d.day)
        }
      }
    });
  } catch (error) {
    console.error('Get spending patterns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch spending patterns'
    });
  }
});

// @route   GET /api/analytics/savings-progress
// @desc    Get savings progress analytics
// @access  Private
router.get('/savings-progress', authenticate, async (req, res) => {
  try {
    const goals = await SavingsGoal.find({ 
      user: req.userId,
      status: { $in: ['active', 'completed'] }
    });
    
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');
    
    // Calculate overall progress
    const totalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
    
    // Goals by category
    const byCategory = {};
    activeGoals.forEach(goal => {
      if (!byCategory[goal.category]) {
        byCategory[goal.category] = { target: 0, saved: 0, count: 0 };
      }
      byCategory[goal.category].target += goal.targetAmount;
      byCategory[goal.category].saved += goal.currentAmount;
      byCategory[goal.category].count += 1;
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          activeGoals: activeGoals.length,
          completedGoals: completedGoals.length,
          totalTarget,
          totalSaved,
          overallProgress: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0
        },
        byCategory,
        goals: activeGoals.map(g => ({
          id: g._id,
          name: g.name,
          category: g.category,
          progress: g.progressPercentage,
          remaining: g.remainingAmount,
          daysRemaining: g.daysRemaining
        }))
      }
    });
  } catch (error) {
    console.error('Get savings progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch savings progress'
    });
  }
});

// @route   GET /api/analytics/investment-performance
// @desc    Get investment performance analytics
// @access  Private
router.get('/investment-performance', authenticate, async (req, res) => {
  try {
    const [portfolio, overall] = await Promise.all([
      Investment.getPortfolioSummary(req.userId),
      Investment.getOverallStats(req.userId)
    ]);
    
    res.json({
      success: true,
      data: {
        overall,
        byType: portfolio.map(item => ({
          type: item._id,
          count: item.count,
          invested: item.totalInvested,
          currentValue: item.totalCurrentValue,
          profitLoss: item.profitLoss,
          profitLossPercentage: item.totalInvested > 0 
            ? Math.round((item.profitLoss / item.totalInvested) * 100 * 10) / 10 
            : 0
        }))
      }
    });
  } catch (error) {
    console.error('Get investment performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch investment performance'
    });
  }
});

// @route   GET /api/analytics/budget-utilization
// @desc    Get budget utilization analytics
// @access  Private
router.get('/budget-utilization', authenticate, async (req, res) => {
  try {
    const budgets = await Budget.getCurrentBudgets(req.userId);
    
    const utilization = budgets.map(b => ({
      category: b.category,
      budget: b.amount,
      spent: b.spent,
      remaining: b.remaining,
      usagePercentage: b.usagePercentage,
      status: b.status
    }));
    
    const summary = await Budget.getSummary(req.userId);
    
    // Categories over budget
    const overBudget = utilization.filter(u => u.usagePercentage >= 100);
    const nearBudget = utilization.filter(u => u.usagePercentage >= 75 && u.usagePercentage < 100);
    
    res.json({
      success: true,
      data: {
        utilization,
        summary,
        alerts: {
          overBudget: overBudget.map(u => u.category),
          nearBudget: nearBudget.map(u => u.category)
        }
      }
    });
  } catch (error) {
    console.error('Get budget utilization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget utilization'
    });
  }
});

module.exports = router;
