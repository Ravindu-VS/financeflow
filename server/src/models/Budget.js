const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Budget name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'food', 'transport', 'bills', 'entertainment', 'shopping', 
      'education', 'healthcare', 'housing', 'insurance', 'personal',
      'travel', 'gifts', 'subscriptions', 'investments', 'savings', 'other', 'total'
    ]
  },
  amount: {
    type: Number,
    required: [true, 'Budget amount is required'],
    min: [0, 'Budget amount cannot be negative']
  },
  spent: {
    type: Number,
    default: 0,
    min: 0
  },
  period: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  icon: {
    type: String,
    default: '💰'
  },
  alerts: {
    enabled: { type: Boolean, default: true },
    thresholds: {
      warning: { type: Number, default: 75 },  // 75%
      critical: { type: Number, default: 90 }  // 90%
    },
    lastAlertSent: Date,
    lastAlertType: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rollover: {
    enabled: { type: Boolean, default: false },
    amount: { type: Number, default: 0 }  // Unused amount from previous period
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
budgetSchema.index({ user: 1, category: 1 });
budgetSchema.index({ user: 1, isActive: 1 });
budgetSchema.index({ user: 1, startDate: 1, endDate: 1 });

// Virtual for remaining budget
budgetSchema.virtual('remaining').get(function() {
  const totalBudget = this.rollover.enabled ? this.amount + this.rollover.amount : this.amount;
  return Math.max(0, totalBudget - this.spent);
});

// Virtual for usage percentage
budgetSchema.virtual('usagePercentage').get(function() {
  const totalBudget = this.rollover.enabled ? this.amount + this.rollover.amount : this.amount;
  if (totalBudget === 0) return 0;
  return Math.min(100, Math.round((this.spent / totalBudget) * 100));
});

// Virtual for status
budgetSchema.virtual('status').get(function() {
  const percentage = this.usagePercentage;
  if (percentage >= 100) return 'exceeded';
  if (percentage >= this.alerts.thresholds.critical) return 'critical';
  if (percentage >= this.alerts.thresholds.warning) return 'warning';
  return 'healthy';
});

// Virtual for daily budget (for monthly budgets)
budgetSchema.virtual('dailyBudget').get(function() {
  const daysInPeriod = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  return this.amount / daysInPeriod;
});

// Include virtuals
budgetSchema.set('toJSON', { virtuals: true });
budgetSchema.set('toObject', { virtuals: true });

// Static method to get current month's budgets
budgetSchema.statics.getCurrentBudgets = async function(userId) {
  const now = new Date();
  return await this.find({
    user: userId,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ category: 1 });
};

// Static method to update spent amount for a category
budgetSchema.statics.updateSpent = async function(userId, category, amount) {
  const now = new Date();
  const budget = await this.findOne({
    user: userId,
    category: category,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  });
  
  if (budget) {
    budget.spent += amount;
    await budget.save();
    return budget;
  }
  return null;
};

// Static method to get budget summary
budgetSchema.statics.getSummary = async function(userId) {
  const now = new Date();
  const budgets = await this.find({
    user: userId,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  });
  
  let totalBudget = 0;
  let totalSpent = 0;
  let categoriesOverBudget = 0;
  
  budgets.forEach(b => {
    if (b.category !== 'total') {
      totalBudget += b.amount;
      totalSpent += b.spent;
      if (b.spent > b.amount) categoriesOverBudget++;
    }
  });
  
  return {
    totalBudget,
    totalSpent,
    remaining: totalBudget - totalSpent,
    usagePercentage: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    categoriesOverBudget,
    budgetCount: budgets.length
  };
};

module.exports = mongoose.model('Budget', budgetSchema);
