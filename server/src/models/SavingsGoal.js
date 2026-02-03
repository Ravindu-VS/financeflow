const mongoose = require('mongoose');

const savingsGoalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Goal name is required'],
    trim: true,
    maxlength: [100, 'Goal name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  targetAmount: {
    type: Number,
    required: [true, 'Target amount is required'],
    min: [1, 'Target amount must be at least 1']
  },
  currentAmount: {
    type: Number,
    default: 0,
    min: [0, 'Current amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR'
  },
  category: {
    type: String,
    enum: ['emergency_fund', 'vacation', 'home', 'car', 'education', 'wedding', 'retirement', 'investment', 'gadget', 'other'],
    default: 'other'
  },
  icon: {
    type: String,
    default: '🎯'
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  targetDate: {
    type: Date,
    required: [true, 'Target date is required']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  autoSave: {
    isEnabled: { type: Boolean, default: false },
    amount: Number,
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly']
    },
    nextDate: Date
  },
  contributions: [{
    amount: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    note: String,
    isAutomatic: { type: Boolean, default: false }
  }],
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'cancelled'],
    default: 'active'
  },
  completedAt: Date,
  reminders: {
    isEnabled: { type: Boolean, default: true },
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    },
    nextReminder: Date
  }
}, {
  timestamps: true
});

// Indexes
savingsGoalSchema.index({ user: 1, status: 1 });
savingsGoalSchema.index({ user: 1, targetDate: 1 });

// Virtual for progress percentage
savingsGoalSchema.virtual('progressPercentage').get(function() {
  if (this.targetAmount === 0) return 0;
  return Math.min(100, Math.round((this.currentAmount / this.targetAmount) * 100));
});

// Virtual for remaining amount
savingsGoalSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.targetAmount - this.currentAmount);
});

// Virtual for days remaining
savingsGoalSchema.virtual('daysRemaining').get(function() {
  const today = new Date();
  const target = new Date(this.targetDate);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Virtual for required monthly savings
savingsGoalSchema.virtual('requiredMonthlySavings').get(function() {
  const daysRemaining = this.daysRemaining;
  if (daysRemaining <= 0) return this.remainingAmount;
  const monthsRemaining = daysRemaining / 30;
  return Math.ceil(this.remainingAmount / monthsRemaining);
});

// Include virtuals in JSON
savingsGoalSchema.set('toJSON', { virtuals: true });
savingsGoalSchema.set('toObject', { virtuals: true });

// Pre-save hook to check completion
savingsGoalSchema.pre('save', function(next) {
  if (this.currentAmount >= this.targetAmount && this.status === 'active') {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  next();
});

// Static method to get all goals summary
savingsGoalSchema.statics.getSummary = async function(userId) {
  const result = await this.aggregate([
    {
      $match: { user: new mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalTarget: { $sum: '$targetAmount' },
        totalSaved: { $sum: '$currentAmount' }
      }
    }
  ]);
  return result;
};

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);
