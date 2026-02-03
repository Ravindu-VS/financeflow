require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cron = require('node-cron');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const incomeRoutes = require('./routes/income');
const expenseRoutes = require('./routes/expense');
const savingsRoutes = require('./routes/savings');
const investmentRoutes = require('./routes/investment');
const budgetRoutes = require('./routes/budget');
const analyticsRoutes = require('./routes/analytics');
const insightsRoutes = require('./routes/insights');
const marketRoutes = require('./routes/market');

// Import services
const { generateMonthlyReports } = require('./services/reportService');
const { checkBudgetAlerts } = require('./services/alertService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/market', marketRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Wealth Intelligence API is running',
    timestamp: new Date().toISOString()
  });
});

// Scheduled Tasks
// Daily budget check at 8 PM
cron.schedule('0 20 * * *', async () => {
  console.log('📊 Running daily budget alerts check...');
  await checkBudgetAlerts();
});

// Monthly report generation on 1st of each month
cron.schedule('0 9 1 * *', async () => {
  console.log('📈 Generating monthly reports...');
  await generateMonthlyReports();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
