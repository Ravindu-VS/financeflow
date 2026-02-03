const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
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
  source: {
    type: String,
    required: [true, 'Income source is required'],
    enum: ['salary', 'freelance', 'business', 'passive', 'investment', 'rental', 'bonus', 'gift', 'refund', 'other']
  },
  category: {
    type: String,
    required: true,
    default: 'general'
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
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  metadata: {
    payer: String,
    reference: String,
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'cash', 'check', 'upi', 'card', 'other']
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
incomeSchema.index({ user: 1, date: -1 });
incomeSchema.index({ user: 1, source: 1 });
incomeSchema.index({ user: 1, createdAt: -1 });

// Static method to get total income for a period
incomeSchema.statics.getTotalForPeriod = async function(userId, startDate, endDate) {
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

// Static method to get income by source
incomeSchema.statics.getBySource = async function(userId, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$source',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);
};

// Static method to get monthly income trend
incomeSchema.statics.getMonthlyTrend = async function(userId, months = 12) {
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

module.exports = mongoose.model('Income', incomeSchema);
