const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'food', 'transport', 'bills', 'entertainment', 'shopping', 
      'education', 'healthcare', 'housing', 'insurance', 'personal',
      'travel', 'gifts', 'subscriptions', 'investments', 'debt_payment', 'other'
    ]
  },
  subCategory: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringDetails: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']
    },
    startDate: Date,
    endDate: Date,
    nextDueDate: Date,
    isActive: { type: Boolean, default: true }
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer', 'wallet', 'other'],
    default: 'cash'
  },
  merchant: {
    name: String,
    location: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  receipt: {
    filename: String,
    url: String,
    uploadedAt: Date
  },
  isNecessary: {
    type: Boolean,
    default: true
  },
  budgetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Budget'
  },
  // AI-related fields
  aiCategory: {
    suggested: String,
    confidence: Number,
    isAccepted: Boolean
  },
  sentiment: {
    type: String,
    enum: ['essential', 'useful', 'impulse', 'wasteful']
  }
}, {
  timestamps: true
});

// Indexes
expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1 });
expenseSchema.index({ user: 1, createdAt: -1 });

// Get total expenses for a period
expenseSchema.statics.getTotalForPeriod = async function(userId, startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  return result[0] || { total: 0, count: 0 };
};

// Get expenses by category
expenseSchema.statics.getByCategory = async function(userId, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);
};

// Get daily expenses for a month
expenseSchema.statics.getDailyExpenses = async function(userId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { $dayOfMonth: '$date' },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

// Get monthly expense trend
expenseSchema.statics.getMonthlyTrend = async function(userId, months = 12) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  return await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' }
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);
};

// Get spending patterns by day of week
expenseSchema.statics.getWeekdayPattern = async function(userId, months = 3) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  return await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: { $dayOfWeek: '$date' },
        total: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

module.exports = mongoose.model('Expense', expenseSchema);
