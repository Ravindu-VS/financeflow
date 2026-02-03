const Income = require('../models/Income');
const Expense = require('../models/Expense');
const SavingsGoal = require('../models/SavingsGoal');
const Investment = require('../models/Investment');
const Budget = require('../models/Budget');
const User = require('../models/User');

class FinancialInsightsEngine {
  constructor(userId) {
    this.userId = userId;
    this.userData = null;
  }

  async loadUserData() {
    if (this.userData) return this.userData;

    const now = new Date();
    const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

    const [user, incomes, expenses, incomeTrend, expenseTrend, savingsGoals, investments, budgets] = await Promise.all([
      User.findById(this.userId),
      Income.find({ user: this.userId, date: { $gte: threeMonthsAgo } }).sort({ date: -1 }),
      Expense.find({ user: this.userId, date: { $gte: threeMonthsAgo } }).sort({ date: -1 }),
      Income.getMonthlyTrend(this.userId, 6),
      Expense.getMonthlyTrend(this.userId, 6),
      SavingsGoal.find({ user: this.userId, status: 'active' }),
      Investment.find({ user: this.userId, status: 'active' }),
      Budget.getCurrentBudgets(this.userId)
    ]);

    this.userData = {
      user,
      incomes,
      expenses,
      incomeTrend,
      expenseTrend,
      savingsGoals,
      investments,
      budgets,
      currentMonthIncome: await Income.getTotalForPeriod(this.userId, startOfMonth, endOfMonth),
      currentMonthExpenses: await Expense.getTotalForPeriod(this.userId, startOfMonth, endOfMonth)
    };

    return this.userData;
  }

  async generatePredictions() {
    const data = await this.loadUserData();
    const predictions = [];

    // End of month balance prediction
    const avgDailyExpense = this.calculateAverageDailyExpense(data);
    const daysRemaining = this.getDaysRemainingInMonth();
    const projectedExpenses = data.currentMonthExpenses.total + (avgDailyExpense * daysRemaining);
    const projectedBalance = data.currentMonthIncome.total - projectedExpenses;

    predictions.push({
      type: 'end_of_month_balance',
      title: 'End of Month Balance Prediction',
      value: Math.round(projectedBalance),
      confidence: this.calculateConfidence(data.expenseTrend.length),
      trend: projectedBalance > 0 ? 'positive' : 'negative',
      description: projectedBalance > 0
        ? `You're projected to save ₹${Math.round(projectedBalance).toLocaleString()} by month end.`
        : `You might overspend by ₹${Math.abs(Math.round(projectedBalance)).toLocaleString()} this month.`
    });

    // Savings growth forecast
    if (data.savingsGoals.length > 0) {
      const totalSavingsTarget = data.savingsGoals.reduce((sum, g) => sum + g.targetAmount, 0);
      const totalCurrentSavings = data.savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);
      const avgMonthlySavings = this.calculateAverageMonthlySavings(data);
      const monthsToComplete = avgMonthlySavings > 0 
        ? Math.ceil((totalSavingsTarget - totalCurrentSavings) / avgMonthlySavings)
        : null;

      predictions.push({
        type: 'savings_forecast',
        title: 'Savings Goal Completion',
        value: monthsToComplete,
        unit: 'months',
        confidence: this.calculateConfidence(data.incomeTrend.length),
        description: monthsToComplete
          ? `At current pace, you'll reach all savings goals in ~${monthsToComplete} months.`
          : 'Start saving to see predictions for your goals.'
      });
    }

    // Expense trend prediction
    const expenseGrowthRate = this.calculateGrowthRate(data.expenseTrend);
    const nextMonthExpensePrediction = data.currentMonthExpenses.total * (1 + expenseGrowthRate / 100);

    predictions.push({
      type: 'expense_trend',
      title: 'Next Month Expense Prediction',
      value: Math.round(nextMonthExpensePrediction),
      growthRate: Math.round(expenseGrowthRate * 10) / 10,
      confidence: this.calculateConfidence(data.expenseTrend.length),
      trend: expenseGrowthRate > 5 ? 'increasing' : expenseGrowthRate < -5 ? 'decreasing' : 'stable',
      description: `Based on trends, next month's expenses could be around ₹${Math.round(nextMonthExpensePrediction).toLocaleString()}.`
    });

    return predictions;
  }

  async generateSavingSuggestions() {
    const data = await this.loadUserData();
    const suggestions = [];

    // Analyze expense categories
    const expensesByCategory = this.groupByCategory(data.expenses);
    const sortedCategories = Object.entries(expensesByCategory)
      .sort(([, a], [, b]) => b - a);

    // Top spending category suggestion
    if (sortedCategories.length > 0) {
      const [topCategory, topAmount] = sortedCategories[0];
      const potentialSaving = Math.round(topAmount * 0.15); // 15% reduction

      suggestions.push({
        type: 'reduce_spending',
        category: topCategory,
        potentialSaving,
        priority: 'high',
        title: `Reduce ${this.formatCategory(topCategory)} Spending`,
        description: `You spent ₹${topAmount.toLocaleString()} on ${topCategory}. Reducing by 15% could save you ₹${potentialSaving.toLocaleString()}.`,
        actionable: true
      });
    }

    // Weekend spending analysis
    const weekendExpenses = this.getWeekendExpenses(data.expenses);
    const weekdayExpenses = data.expenses.filter(e => !this.isWeekend(e.date));
    const avgWeekendDaily = weekendExpenses.reduce((sum, e) => sum + e.amount, 0) / 
      (weekendExpenses.length || 1);
    const avgWeekdayDaily = weekdayExpenses.reduce((sum, e) => sum + e.amount, 0) / 
      (weekdayExpenses.length || 1);

    if (avgWeekendDaily > avgWeekdayDaily * 1.3) {
      const weekendExtra = Math.round((avgWeekendDaily - avgWeekdayDaily) * 8); // 8 weekend days per month
      suggestions.push({
        type: 'weekend_spending',
        potentialSaving: weekendExtra,
        priority: 'medium',
        title: 'High Weekend Spending Detected',
        description: `You spend ${Math.round((avgWeekendDaily / avgWeekdayDaily - 1) * 100)}% more on weekends. Managing this could save ~₹${weekendExtra.toLocaleString()}/month.`,
        actionable: true
      });
    }

    // Recurring expenses review
    const recurringExpenses = data.expenses.filter(e => e.isRecurring);
    if (recurringExpenses.length > 0) {
      const totalRecurring = recurringExpenses.reduce((sum, e) => sum + e.amount, 0);
      suggestions.push({
        type: 'review_subscriptions',
        amount: totalRecurring,
        priority: 'medium',
        title: 'Review Recurring Expenses',
        description: `You have ₹${totalRecurring.toLocaleString()} in recurring expenses. Review and cancel unused subscriptions.`,
        actionable: true
      });
    }

    // Unnecessary expense flagging
    const unnecessaryExpenses = data.expenses.filter(e => e.isNecessary === false);
    if (unnecessaryExpenses.length > 0) {
      const unnecessaryTotal = unnecessaryExpenses.reduce((sum, e) => sum + e.amount, 0);
      suggestions.push({
        type: 'unnecessary_expenses',
        potentialSaving: unnecessaryTotal,
        priority: 'high',
        title: 'Reduce Non-Essential Spending',
        description: `You marked ₹${unnecessaryTotal.toLocaleString()} as non-essential. Consider reducing these expenses.`,
        actionable: true
      });
    }

    // Budget optimization
    const overBudgetCategories = data.budgets.filter(b => b.usagePercentage >= 100);
    if (overBudgetCategories.length > 0) {
      suggestions.push({
        type: 'budget_exceeded',
        categories: overBudgetCategories.map(b => b.category),
        priority: 'high',
        title: 'Budget Exceeded in Categories',
        description: `You've exceeded budget in ${overBudgetCategories.length} categories. Consider adjusting spending or budget.`,
        actionable: true
      });
    }

    // Emergency fund suggestion
    const monthlyIncome = data.user.financialSetup?.monthlyIncome || data.currentMonthIncome.total;
    const emergencyFundGoal = data.savingsGoals.find(g => g.category === 'emergency_fund');
    if (!emergencyFundGoal && monthlyIncome > 0) {
      const recommendedEmergency = monthlyIncome * 6;
      suggestions.push({
        type: 'emergency_fund',
        recommendedAmount: recommendedEmergency,
        priority: 'high',
        title: 'Build an Emergency Fund',
        description: `Consider creating an emergency fund of ₹${recommendedEmergency.toLocaleString()} (6 months of expenses).`,
        actionable: true
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async generateInvestmentRecommendations() {
    const data = await this.loadUserData();
    const riskProfile = data.user.financialSetup?.riskProfile || 'medium';
    const monthlyIncome = data.user.financialSetup?.monthlyIncome || data.currentMonthIncome.total;
    const currentSavings = data.currentMonthIncome.total - data.currentMonthExpenses.total;

    const recommendations = [];

    // Portfolio analysis
    const portfolioValue = data.investments.reduce((sum, i) => sum + i.currentValue, 0);
    const portfolioAllocation = this.calculatePortfolioAllocation(data.investments);

    // Risk-based recommendations
    const idealAllocations = this.getIdealAllocation(riskProfile);
    
    recommendations.push({
      type: 'portfolio_rebalance',
      title: 'Portfolio Allocation Review',
      currentAllocation: portfolioAllocation,
      idealAllocation: idealAllocations,
      description: this.getRebalanceAdvice(portfolioAllocation, idealAllocations, riskProfile)
    });

    // Investment amount suggestion
    const recommendedInvestment = Math.round(monthlyIncome * this.getInvestmentRatio(riskProfile));
    if (currentSavings >= recommendedInvestment) {
      recommendations.push({
        type: 'investment_opportunity',
        title: 'Investment Opportunity',
        amount: recommendedInvestment,
        description: `Based on your income and savings, consider investing ₹${recommendedInvestment.toLocaleString()}/month.`,
        options: this.getInvestmentOptions(riskProfile, recommendedInvestment)
      });
    }

    // SIP recommendation
    recommendations.push({
      type: 'sip_recommendation',
      title: 'Start a SIP',
      description: 'Systematic Investment Plans help build wealth through disciplined investing.',
      benefits: [
        'Rupee cost averaging',
        'Power of compounding',
        'Disciplined investing',
        'Flexibility to start small'
      ],
      suggestedAmount: Math.round(currentSavings * 0.3)
    });

    // Tax-saving suggestion (if near financial year end)
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 0 && currentMonth <= 2) { // Jan-Mar
      recommendations.push({
        type: 'tax_saving',
        title: 'Tax-Saving Investment Alert',
        description: 'Financial year ending soon. Consider tax-saving investments under Section 80C.',
        options: ['ELSS Mutual Funds', 'PPF', 'NPS', 'Tax-saving FD']
      });
    }

    return recommendations;
  }

  async analyzeBehavior() {
    const data = await this.loadUserData();
    const insights = [];

    // Spending consistency
    const monthlyTotals = data.expenseTrend.map(m => m.total);
    const avgMonthly = monthlyTotals.reduce((a, b) => a + b, 0) / (monthlyTotals.length || 1);
    const variance = this.calculateVariance(monthlyTotals, avgMonthly);

    if (variance > avgMonthly * 0.3) {
      insights.push({
        type: 'inconsistent_spending',
        severity: 'warning',
        title: 'Inconsistent Spending Pattern',
        description: 'Your monthly spending varies significantly. Consider creating a budget for better control.'
      });
    }

    // Category trends
    const categoryTrends = this.analyzeCategoryTrends(data.expenses);
    const increasingCategories = Object.entries(categoryTrends)
      .filter(([, trend]) => trend > 10)
      .map(([category, trend]) => ({ category, trend: Math.round(trend) }));

    if (increasingCategories.length > 0) {
      insights.push({
        type: 'increasing_categories',
        severity: 'info',
        title: 'Rising Expense Categories',
        categories: increasingCategories,
        description: `Spending increased in: ${increasingCategories.map(c => `${c.category} (+${c.trend}%)`).join(', ')}`
      });
    }

    // Savings behavior
    const savingsRate = data.currentMonthIncome.total > 0
      ? ((data.currentMonthIncome.total - data.currentMonthExpenses.total) / data.currentMonthIncome.total) * 100
      : 0;

    let savingsAssessment;
    if (savingsRate >= 30) {
      savingsAssessment = { status: 'excellent', message: 'Excellent saving habits! Keep it up.' };
    } else if (savingsRate >= 20) {
      savingsAssessment = { status: 'good', message: 'Good savings rate. Try to increase to 30% for faster wealth growth.' };
    } else if (savingsRate >= 10) {
      savingsAssessment = { status: 'average', message: 'Consider reducing expenses to increase savings.' };
    } else {
      savingsAssessment = { status: 'poor', message: 'Low savings detected. Review expenses urgently.' };
    }

    insights.push({
      type: 'savings_rate',
      severity: savingsRate < 10 ? 'warning' : 'info',
      title: 'Savings Rate Analysis',
      rate: Math.round(savingsRate),
      ...savingsAssessment
    });

    // Investment behavior
    const totalInvested = data.investments.reduce((sum, i) => sum + i.investedAmount, 0);
    const incomeToInvestmentRatio = data.currentMonthIncome.total > 0
      ? (totalInvested / (data.currentMonthIncome.total * 12)) * 100
      : 0;

    if (incomeToInvestmentRatio < 20) {
      insights.push({
        type: 'low_investment',
        severity: 'warning',
        title: 'Investment Opportunity',
        description: 'Your investment portfolio is relatively small. Consider allocating more towards investments.'
      });
    }

    return insights;
  }

  async calculateFinancialHealth() {
    const data = await this.loadUserData();
    
    let score = 0;
    const factors = [];

    // Savings rate (max 25 points)
    const savingsRate = data.currentMonthIncome.total > 0
      ? ((data.currentMonthIncome.total - data.currentMonthExpenses.total) / data.currentMonthIncome.total) * 100
      : 0;
    const savingsScore = Math.min(25, (savingsRate / 30) * 25);
    score += savingsScore;
    factors.push({
      name: 'Savings Rate',
      score: Math.round(savingsScore),
      maxScore: 25,
      status: savingsRate >= 20 ? 'good' : savingsRate >= 10 ? 'average' : 'poor'
    });

    // Budget adherence (max 20 points)
    const budgetScore = this.calculateBudgetScore(data.budgets);
    score += budgetScore;
    factors.push({
      name: 'Budget Adherence',
      score: Math.round(budgetScore),
      maxScore: 20,
      status: budgetScore >= 15 ? 'good' : budgetScore >= 10 ? 'average' : 'poor'
    });

    // Emergency fund (max 20 points)
    const emergencyFund = data.savingsGoals.find(g => g.category === 'emergency_fund');
    const monthlyExpense = data.currentMonthExpenses.total;
    const emergencyFundMonths = emergencyFund ? emergencyFund.currentAmount / monthlyExpense : 0;
    const emergencyScore = Math.min(20, (emergencyFundMonths / 6) * 20);
    score += emergencyScore;
    factors.push({
      name: 'Emergency Fund',
      score: Math.round(emergencyScore),
      maxScore: 20,
      status: emergencyFundMonths >= 6 ? 'good' : emergencyFundMonths >= 3 ? 'average' : 'poor'
    });

    // Investment diversification (max 20 points)
    const diversificationScore = this.calculateDiversificationScore(data.investments);
    score += diversificationScore;
    factors.push({
      name: 'Investment Diversification',
      score: Math.round(diversificationScore),
      maxScore: 20,
      status: diversificationScore >= 15 ? 'good' : diversificationScore >= 10 ? 'average' : 'poor'
    });

    // Goal progress (max 15 points)
    const goalProgress = data.savingsGoals.length > 0
      ? data.savingsGoals.reduce((sum, g) => sum + g.progressPercentage, 0) / data.savingsGoals.length
      : 0;
    const goalScore = (goalProgress / 100) * 15;
    score += goalScore;
    factors.push({
      name: 'Goal Progress',
      score: Math.round(goalScore),
      maxScore: 15,
      status: goalProgress >= 70 ? 'good' : goalProgress >= 40 ? 'average' : 'poor'
    });

    // Determine grade
    let grade, gradeDescription;
    if (score >= 85) {
      grade = 'A+';
      gradeDescription = 'Excellent financial health! Keep up the great work.';
    } else if (score >= 70) {
      grade = 'A';
      gradeDescription = 'Very good financial standing with room for optimization.';
    } else if (score >= 55) {
      grade = 'B';
      gradeDescription = 'Good progress. Focus on weak areas to improve.';
    } else if (score >= 40) {
      grade = 'C';
      gradeDescription = 'Average financial health. Consider reviewing your financial strategy.';
    } else {
      grade = 'D';
      gradeDescription = 'Needs improvement. Start with budgeting and emergency fund.';
    }

    return {
      score: Math.round(score),
      maxScore: 100,
      grade,
      gradeDescription,
      factors,
      lastCalculated: new Date().toISOString()
    };
  }

  // Helper methods
  calculateAverageDailyExpense(data) {
    const dayOfMonth = new Date().getDate();
    return data.currentMonthExpenses.total / dayOfMonth;
  }

  getDaysRemainingInMonth() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate();
  }

  calculateConfidence(dataPoints) {
    if (dataPoints >= 6) return 'high';
    if (dataPoints >= 3) return 'medium';
    return 'low';
  }

  calculateAverageMonthlySavings(data) {
    if (data.incomeTrend.length === 0 || data.expenseTrend.length === 0) return 0;
    
    const avgIncome = data.incomeTrend.reduce((sum, m) => sum + m.total, 0) / data.incomeTrend.length;
    const avgExpense = data.expenseTrend.reduce((sum, m) => sum + m.total, 0) / data.expenseTrend.length;
    
    return Math.max(0, avgIncome - avgExpense);
  }

  calculateGrowthRate(trend) {
    if (trend.length < 2) return 0;
    
    const recent = trend.slice(-3);
    if (recent.length < 2) return 0;
    
    const first = recent[0].total;
    const last = recent[recent.length - 1].total;
    
    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }

  groupByCategory(expenses) {
    return expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});
  }

  formatCategory(category) {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  getWeekendExpenses(expenses) {
    return expenses.filter(e => this.isWeekend(e.date));
  }

  isWeekend(date) {
    const day = new Date(date).getDay();
    return day === 0 || day === 6;
  }

  calculateVariance(values, mean) {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  analyzeCategoryTrends(expenses) {
    const now = new Date();
    const thisMonth = expenses.filter(e => 
      new Date(e.date).getMonth() === now.getMonth()
    );
    const lastMonth = expenses.filter(e => 
      new Date(e.date).getMonth() === now.getMonth() - 1
    );

    const thisMonthByCategory = this.groupByCategory(thisMonth);
    const lastMonthByCategory = this.groupByCategory(lastMonth);

    const trends = {};
    Object.keys(thisMonthByCategory).forEach(category => {
      const current = thisMonthByCategory[category];
      const previous = lastMonthByCategory[category] || 0;
      if (previous > 0) {
        trends[category] = ((current - previous) / previous) * 100;
      }
    });

    return trends;
  }

  calculatePortfolioAllocation(investments) {
    const total = investments.reduce((sum, i) => sum + i.currentValue, 0);
    if (total === 0) return {};

    const allocation = {};
    investments.forEach(inv => {
      allocation[inv.type] = (allocation[inv.type] || 0) + inv.currentValue;
    });

    Object.keys(allocation).forEach(type => {
      allocation[type] = Math.round((allocation[type] / total) * 100);
    });

    return allocation;
  }

  getIdealAllocation(riskProfile) {
    const allocations = {
      low: { stocks: 20, mutual_funds: 20, fixed_deposit: 40, gold: 10, bonds: 10 },
      medium: { stocks: 35, mutual_funds: 30, fixed_deposit: 20, gold: 10, bonds: 5 },
      high: { stocks: 50, mutual_funds: 25, fixed_deposit: 10, gold: 5, crypto: 10 }
    };
    return allocations[riskProfile] || allocations.medium;
  }

  getRebalanceAdvice(current, ideal, riskProfile) {
    if (Object.keys(current).length === 0) {
      return 'Start building your investment portfolio based on your risk profile.';
    }
    return `Your portfolio is set for ${riskProfile} risk. Consider rebalancing to match ideal allocation for optimal returns.`;
  }

  getInvestmentRatio(riskProfile) {
    const ratios = { low: 0.15, medium: 0.25, high: 0.35 };
    return ratios[riskProfile] || 0.25;
  }

  getInvestmentOptions(riskProfile, amount) {
    const options = {
      low: [
        { type: 'Fixed Deposit', allocation: 40, amount: Math.round(amount * 0.4) },
        { type: 'Debt Mutual Funds', allocation: 30, amount: Math.round(amount * 0.3) },
        { type: 'PPF', allocation: 20, amount: Math.round(amount * 0.2) },
        { type: 'Gold', allocation: 10, amount: Math.round(amount * 0.1) }
      ],
      medium: [
        { type: 'Equity Mutual Funds', allocation: 40, amount: Math.round(amount * 0.4) },
        { type: 'Index Funds', allocation: 25, amount: Math.round(amount * 0.25) },
        { type: 'Fixed Deposit', allocation: 20, amount: Math.round(amount * 0.2) },
        { type: 'Gold', allocation: 15, amount: Math.round(amount * 0.15) }
      ],
      high: [
        { type: 'Direct Stocks', allocation: 40, amount: Math.round(amount * 0.4) },
        { type: 'Small-cap Funds', allocation: 25, amount: Math.round(amount * 0.25) },
        { type: 'Mid-cap Funds', allocation: 20, amount: Math.round(amount * 0.2) },
        { type: 'Crypto', allocation: 15, amount: Math.round(amount * 0.15) }
      ]
    };
    return options[riskProfile] || options.medium;
  }

  calculateBudgetScore(budgets) {
    if (budgets.length === 0) return 10; // Default score if no budgets
    
    const avgUtilization = budgets.reduce((sum, b) => sum + Math.min(100, b.usagePercentage), 0) / budgets.length;
    
    // Score is higher when utilization is between 70-90%
    if (avgUtilization >= 70 && avgUtilization <= 90) return 20;
    if (avgUtilization >= 50 && avgUtilization < 70) return 17;
    if (avgUtilization > 90 && avgUtilization <= 100) return 15;
    if (avgUtilization > 100) return 10;
    return 12;
  }

  calculateDiversificationScore(investments) {
    if (investments.length === 0) return 0;
    
    const types = new Set(investments.map(i => i.type));
    const typeCount = types.size;
    
    // More types = better diversification
    if (typeCount >= 5) return 20;
    if (typeCount >= 4) return 17;
    if (typeCount >= 3) return 14;
    if (typeCount >= 2) return 10;
    return 5;
  }
}

module.exports = { FinancialInsightsEngine };
