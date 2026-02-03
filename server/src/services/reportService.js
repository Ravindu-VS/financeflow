const Income = require('../models/Income');
const Expense = require('../models/Expense');
const SavingsGoal = require('../models/SavingsGoal');
const Investment = require('../models/Investment');
const Budget = require('../models/Budget');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Generate monthly financial reports for all users
 */
async function generateMonthlyReports() {
  try {
    const users = await User.find({ 
      isActive: true,
      'preferences.notifications.monthlyReport': true
    });
    
    for (const user of users) {
      const report = await generateUserReport(user._id);
      
      // Create notification with report summary
      await Notification.createNotification({
        user: user._id,
        type: 'monthly_report',
        title: '📊 Your Monthly Financial Report is Ready',
        message: `Income: ₹${report.income.toLocaleString()} | Expenses: ₹${report.expenses.toLocaleString()} | Savings: ₹${report.savings.toLocaleString()}`,
        priority: 'medium',
        data: {
          income: report.income,
          expenses: report.expenses,
          savings: report.savings,
          savingsRate: report.savingsRate,
          topCategories: report.topCategories
        },
        isActionable: true,
        action: {
          label: 'View Full Report',
          link: '/reports/monthly',
          type: 'navigate'
        }
      });
    }
    
    console.log(`✅ Generated monthly reports for ${users.length} users`);
  } catch (error) {
    console.error('Monthly report generation failed:', error);
  }
}

/**
 * Generate a comprehensive report for a single user
 */
async function generateUserReport(userId, month = null, year = null) {
  const now = new Date();
  const reportMonth = month !== null ? month : now.getMonth();
  const reportYear = year !== null ? year : now.getFullYear();
  
  const startDate = new Date(reportYear, reportMonth, 1);
  const endDate = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59);
  
  // Previous month for comparison
  const prevStartDate = new Date(reportYear, reportMonth - 1, 1);
  const prevEndDate = new Date(reportYear, reportMonth, 0, 23, 59, 59);
  
  const [
    incomeData,
    expenseData,
    prevIncomeData,
    prevExpenseData,
    expenseByCategory,
    incomeBySource,
    savingsGoals,
    investments,
    budgets
  ] = await Promise.all([
    Income.getTotalForPeriod(userId, startDate, endDate),
    Expense.getTotalForPeriod(userId, startDate, endDate),
    Income.getTotalForPeriod(userId, prevStartDate, prevEndDate),
    Expense.getTotalForPeriod(userId, prevStartDate, prevEndDate),
    Expense.getByCategory(userId, startDate, endDate),
    Income.getBySource(userId, startDate, endDate),
    SavingsGoal.find({ user: userId, status: 'active' }),
    Investment.find({ user: userId, status: 'active' }),
    Budget.find({ 
      user: userId, 
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    })
  ]);
  
  // Calculate metrics
  const income = incomeData.total || 0;
  const expenses = expenseData.total || 0;
  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  
  // Changes from previous month
  const incomeChange = prevIncomeData.total > 0
    ? ((income - prevIncomeData.total) / prevIncomeData.total) * 100
    : 0;
  const expenseChange = prevExpenseData.total > 0
    ? ((expenses - prevExpenseData.total) / prevExpenseData.total) * 100
    : 0;
  
  // Top expense categories
  const topCategories = expenseByCategory.slice(0, 5).map(cat => ({
    category: cat._id,
    amount: cat.total,
    percentage: expenses > 0 ? Math.round((cat.total / expenses) * 100) : 0
  }));
  
  // Budget analysis
  const budgetAnalysis = budgets.map(b => ({
    category: b.category,
    budget: b.amount,
    spent: b.spent,
    remaining: b.remaining,
    status: b.status
  }));
  
  // Investment summary
  const totalInvested = investments.reduce((sum, i) => sum + i.investedAmount, 0);
  const totalCurrentValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const investmentGain = totalCurrentValue - totalInvested;
  
  // Savings goals progress
  const goalsProgress = savingsGoals.map(g => ({
    name: g.name,
    target: g.targetAmount,
    current: g.currentAmount,
    progress: g.progressPercentage
  }));
  
  return {
    period: {
      month: reportMonth + 1,
      year: reportYear,
      monthName: startDate.toLocaleString('default', { month: 'long' })
    },
    income,
    expenses,
    savings,
    savingsRate: Math.round(savingsRate * 10) / 10,
    comparison: {
      incomeChange: Math.round(incomeChange * 10) / 10,
      expenseChange: Math.round(expenseChange * 10) / 10
    },
    incomeBySource,
    topCategories,
    budgetAnalysis,
    investments: {
      totalInvested,
      currentValue: totalCurrentValue,
      gain: investmentGain,
      gainPercentage: totalInvested > 0 
        ? Math.round((investmentGain / totalInvested) * 100 * 10) / 10 
        : 0
    },
    savingsGoals: goalsProgress,
    transactionCount: {
      income: incomeData.count || 0,
      expense: expenseData.count || 0
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * Export report as formatted data
 */
function formatReportForExport(report, format = 'json') {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }
  
  // CSV format
  if (format === 'csv') {
    const lines = [
      `Monthly Financial Report - ${report.period.monthName} ${report.period.year}`,
      '',
      'Summary',
      `Total Income,${report.income}`,
      `Total Expenses,${report.expenses}`,
      `Net Savings,${report.savings}`,
      `Savings Rate,${report.savingsRate}%`,
      '',
      'Expense Categories',
      'Category,Amount,Percentage'
    ];
    
    report.topCategories.forEach(cat => {
      lines.push(`${cat.category},${cat.amount},${cat.percentage}%`);
    });
    
    lines.push('', 'Budget Analysis', 'Category,Budget,Spent,Remaining,Status');
    report.budgetAnalysis.forEach(b => {
      lines.push(`${b.category},${b.budget},${b.spent},${b.remaining},${b.status}`);
    });
    
    return lines.join('\n');
  }
  
  return report;
}

module.exports = {
  generateMonthlyReports,
  generateUserReport,
  formatReportForExport
};
