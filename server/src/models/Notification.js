const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'budget_warning', 'budget_critical', 'budget_exceeded',
      'bill_reminder', 'savings_reminder', 'goal_achieved',
      'income_received', 'unusual_expense', 'weekly_report',
      'monthly_report', 'investment_alert', 'market_update',
      'tip', 'system'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  icon: String,
  color: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  data: {
    // Additional data related to the notification
    category: String,
    amount: Number,
    percentage: Number,
    referenceId: mongoose.Schema.Types.ObjectId,
    referenceType: String,
    link: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  isActionable: {
    type: Boolean,
    default: false
  },
  action: {
    label: String,
    link: String,
    type: String
  },
  expiresAt: Date,
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false }
  },
  sentVia: [{
    channel: String,
    sentAt: Date,
    status: String
  }]
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({ user: userId, isRead: false });
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();
  return notification;
};

module.exports = mongoose.model('Notification', notificationSchema);
