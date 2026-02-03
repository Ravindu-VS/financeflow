const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  pin: {
    type: String,
    select: false
  },
  profile: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    avatar: String,
    phone: String
  },
  financialSetup: {
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']
    },
    monthlyIncome: {
      type: Number,
      default: 0
    },
    riskProfile: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    financialGoals: [{
      type: String,
      enum: ['savings', 'emergency_fund', 'investment_growth', 'debt_free', 'retirement', 'education', 'home', 'travel']
    }]
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      billReminders: { type: Boolean, default: true },
      budgetAlerts: { type: Boolean, default: true },
      savingsReminders: { type: Boolean, default: true },
      weeklyReport: { type: Boolean, default: true },
      monthlyReport: { type: Boolean, default: true }
    },
    dashboardLayout: {
      type: String,
      default: 'default'
    }
  },
  security: {
    twoFactorEnabled: { type: Boolean, default: false },
    lastLogin: Date,
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Hash PIN before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('pin') || !this.pin) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.pin = await bcrypt.hash(this.pin, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Compare PIN method
userSchema.methods.comparePin = async function(candidatePin) {
  if (!this.pin) return false;
  return await bcrypt.compare(candidatePin, this.pin);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName || ''}`.trim();
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
