const Notification = require('../models/Notification');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const User = require('../models/User');

/**
 * Check all users' budgets and send alerts if thresholds are exceeded
 */
async function checkBudgetAlerts() {
  try {
    const users = await User.find({ isActive: true });
    
    for (const user of users) {
      if (!user.preferences.notifications.budgetAlerts) continue;
      
      const budgets = await Budget.getCurrentBudgets(user._id);
      
      for (const budget of budgets) {
        const percentage = budget.usagePercentage;
        
        // Check if we need to send an alert
        if (percentage >= budget.alerts.thresholds.critical && 
            budget.alerts.lastAlertType !== 'critical') {
          await createBudgetAlert(user._id, budget, 'critical');
          budget.alerts.lastAlertSent = new Date();
          budget.alerts.lastAlertType = 'critical';
          await budget.save();
        } else if (percentage >= budget.alerts.thresholds.warning && 
                   !budget.alerts.lastAlertType) {
          await createBudgetAlert(user._id, budget, 'warning');
          budget.alerts.lastAlertSent = new Date();
          budget.alerts.lastAlertType = 'warning';
          await budget.save();
        }
      }
    }
    
    console.log('✅ Budget alerts check completed');
  } catch (error) {
    console.error('Budget alerts check failed:', error);
  }
}

/**
 * Create a budget alert notification
 */
async function createBudgetAlert(userId, budget, alertType) {
  const notification = {
    user: userId,
    type: `budget_${alertType}`,
    title: alertType === 'critical' 
      ? `⚠️ Budget Critical: ${budget.category}`
      : `📊 Budget Warning: ${budget.category}`,
    message: alertType === 'critical'
      ? `You've used ${budget.usagePercentage}% of your ${budget.category} budget. Only ₹${budget.remaining} remaining.`
      : `You've used ${budget.usagePercentage}% of your ${budget.category} budget. Consider slowing down.`,
    priority: alertType === 'critical' ? 'high' : 'medium',
    data: {
      category: budget.category,
      amount: budget.amount,
      spent: budget.spent,
      percentage: budget.usagePercentage,
      referenceId: budget._id,
      referenceType: 'Budget'
    },
    isActionable: true,
    action: {
      label: 'View Budget',
      link: `/budgets/${budget._id}`,
      type: 'navigate'
    }
  };
  
  await Notification.createNotification(notification);
}

/**
 * Check savings goals and send reminders
 */
async function checkSavingsReminders() {
  try {
    const goals = await SavingsGoal.find({
      status: 'active',
      'reminders.isEnabled': true,
      'reminders.nextReminder': { $lte: new Date() }
    }).populate('user');
    
    for (const goal of goals) {
      if (!goal.user.preferences.notifications.savingsReminders) continue;
      
      await Notification.createNotification({
        user: goal.user._id,
        type: 'savings_reminder',
        title: `💰 Savings Goal Reminder: ${goal.name}`,
        message: `You're ${goal.progressPercentage}% towards your goal. ${goal.daysRemaining} days remaining. Need to save ₹${goal.requiredMonthlySavings}/month.`,
        priority: goal.daysRemaining <= 30 ? 'high' : 'medium',
        data: {
          referenceId: goal._id,
          referenceType: 'SavingsGoal',
          percentage: goal.progressPercentage
        },
        isActionable: true,
        action: {
          label: 'Add Contribution',
          link: `/savings/${goal._id}`,
          type: 'navigate'
        }
      });
      
      // Update next reminder date
      const nextDate = new Date();
      switch (goal.reminders.frequency) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      }
      goal.reminders.nextReminder = nextDate;
      await goal.save();
    }
    
    console.log('✅ Savings reminders check completed');
  } catch (error) {
    console.error('Savings reminders check failed:', error);
  }
}

/**
 * Send bill due reminders
 */
async function checkBillReminders() {
  try {
    const Expense = require('../models/Expense');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    // Find recurring expenses due tomorrow
    const upcomingBills = await Expense.find({
      isRecurring: true,
      'recurringDetails.isActive': true,
      'recurringDetails.nextDueDate': {
        $gte: tomorrow,
        $lt: dayAfterTomorrow
      }
    }).populate('user');
    
    for (const bill of upcomingBills) {
      if (!bill.user.preferences.notifications.billReminders) continue;
      
      await Notification.createNotification({
        user: bill.user._id,
        type: 'bill_reminder',
        title: `📅 Bill Due Tomorrow: ${bill.description || bill.category}`,
        message: `₹${bill.amount} ${bill.category} payment is due tomorrow.`,
        priority: 'high',
        data: {
          amount: bill.amount,
          category: bill.category,
          referenceId: bill._id,
          referenceType: 'Expense'
        }
      });
    }
    
    console.log('✅ Bill reminders check completed');
  } catch (error) {
    console.error('Bill reminders check failed:', error);
  }
}

module.exports = {
  checkBudgetAlerts,
  checkSavingsReminders,
  checkBillReminders
};
