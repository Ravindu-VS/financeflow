const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authenticate JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found.'
        });
      }
      
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated.'
        });
      }
      
      req.user = user;
      req.userId = user._id;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
      }
    }
    next();
  } catch (error) {
    // Ignore errors and continue without user
    next();
  }
};

// Verify PIN for sensitive operations
const verifyPin = async (req, res, next) => {
  try {
    const { pin } = req.body;
    
    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'PIN is required for this operation.'
      });
    }
    
    const user = await User.findById(req.userId).select('+pin');
    
    if (!user.pin) {
      return res.status(400).json({
        success: false,
        message: 'PIN not set. Please set up your PIN first.'
      });
    }
    
    const isValid = await user.comparePin(pin);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN.'
      });
    }
    
    next();
  } catch (error) {
    console.error('PIN verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'PIN verification failed.'
    });
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  verifyPin
};
