const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Investment name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Investment type is required'],
    enum: ['stocks', 'mutual_funds', 'fixed_deposit', 'crypto', 'gold', 'real_estate', 'bonds', 'etf', 'ppf', 'nps', 'other']
  },
  symbol: {
    type: String,
    trim: true,
    uppercase: true
  },
  platform: {
    type: String,
    trim: true
  },
  investedAmount: {
    type: Number,
    required: [true, 'Invested amount is required'],
    min: [0, 'Invested amount cannot be negative']
  },
  currentValue: {
    type: Number,
    default: 0,
    min: [0, 'Current value cannot be negative']
  },
  units: {
    type: Number,
    default: 1
  },
  purchasePrice: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  purchaseDate: {
    type: Date,
    required: [true, 'Purchase date is required']
  },
  maturityDate: Date,
  interestRate: {
    type: Number,
    min: 0
  },
  riskLevel: {
    type: String,
    enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'matured'],
    default: 'active'
  },
  soldDetails: {
    soldDate: Date,
    soldPrice: Number,
    soldUnits: Number,
    realizedGain: Number
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  transactions: [{
    type: {
      type: String,
      enum: ['buy', 'sell', 'dividend', 'split', 'bonus']
    },
    amount: Number,
    units: Number,
    price: Number,
    date: { type: Date, default: Date.now },
    notes: String
  }],
  dividends: [{
    amount: Number,
    date: Date,
    reinvested: { type: Boolean, default: false }
  }],
  // For tracking price history
  priceHistory: [{
    price: Number,
    date: Date
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes
investmentSchema.index({ user: 1, type: 1 });
investmentSchema.index({ user: 1, status: 1 });
investmentSchema.index({ symbol: 1 });

// Virtual for profit/loss
investmentSchema.virtual('profitLoss').get(function() {
  return this.currentValue - this.investedAmount;
});

// Virtual for profit/loss percentage
investmentSchema.virtual('profitLossPercentage').get(function() {
  if (this.investedAmount === 0) return 0;
  return ((this.currentValue - this.investedAmount) / this.investedAmount) * 100;
});

// Virtual for total dividends
investmentSchema.virtual('totalDividends').get(function() {
  if (!this.dividends || this.dividends.length === 0) return 0;
  return this.dividends.reduce((sum, d) => sum + d.amount, 0);
});

// Virtual for absolute return (including dividends)
investmentSchema.virtual('absoluteReturn').get(function() {
  return this.profitLoss + this.totalDividends;
});

// XIRR calculation for annualized returns would require more complex logic

// Include virtuals in JSON
investmentSchema.set('toJSON', { virtuals: true });
investmentSchema.set('toObject', { virtuals: true });

// Update current value based on current price and units
investmentSchema.methods.updateCurrentValue = function() {
  this.currentValue = this.currentPrice * this.units;
  this.lastUpdated = new Date();
};

// Static method to get portfolio summary
investmentSchema.statics.getPortfolioSummary = async function(userId) {
  const result = await this.aggregate([
    {
      $match: { 
        user: new mongoose.Types.ObjectId(userId),
        status: 'active'
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalInvested: { $sum: '$investedAmount' },
        totalCurrentValue: { $sum: '$currentValue' }
      }
    },
    {
      $project: {
        _id: 1,
        count: 1,
        totalInvested: 1,
        totalCurrentValue: 1,
        profitLoss: { $subtract: ['$totalCurrentValue', '$totalInvested'] }
      }
    },
    {
      $sort: { totalCurrentValue: -1 }
    }
  ]);
  return result;
};

// Static method to get overall portfolio stats
investmentSchema.statics.getOverallStats = async function(userId) {
  const result = await this.aggregate([
    {
      $match: { 
        user: new mongoose.Types.ObjectId(userId),
        status: 'active'
      }
    },
    {
      $group: {
        _id: null,
        totalInvested: { $sum: '$investedAmount' },
        totalCurrentValue: { $sum: '$currentValue' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  if (result.length === 0) {
    return { totalInvested: 0, totalCurrentValue: 0, count: 0, profitLoss: 0, profitLossPercentage: 0 };
  }
  
  const stats = result[0];
  stats.profitLoss = stats.totalCurrentValue - stats.totalInvested;
  stats.profitLossPercentage = stats.totalInvested > 0 
    ? (stats.profitLoss / stats.totalInvested) * 100 
    : 0;
  
  return stats;
};

module.exports = mongoose.model('Investment', investmentSchema);
