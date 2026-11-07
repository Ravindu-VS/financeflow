/**
 * WSO2 API Manager Gateway Simulation
 * FinAI Enterprise — Enterprise API Gateway
 * 
 * Features:
 * - JWT Token Validation (WSO2 IS pattern)
 * - Rate Limiting per user/role
 * - API Analytics logging
 * - Request routing to microservices
 * - API versioning (v1)
 * - CORS management
 * - Health monitoring
 */
require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.GATEWAY_PORT || 8080;

// Analytics store (in production: use Redis/PostgreSQL)
const analyticsStore = {
  requests: [],
  add(entry) {
    this.requests.push({ ...entry, timestamp: new Date().toISOString() });
    if (this.requests.length > 5000) this.requests.shift(); // Keep last 5000
  },
  getSummary() {
    const total = this.requests.length;
    const errors = this.requests.filter(r => r.statusCode >= 400).length;
    const avgLatency = total > 0 
      ? this.requests.reduce((s, r) => s + (r.durationMs || 0), 0) / total 
      : 0;
    
    const byEndpoint = {};
    this.requests.forEach(r => {
      byEndpoint[r.path] = (byEndpoint[r.path] || 0) + 1;
    });
    
    return { total, errors, errorRate: total > 0 ? (errors/total*100).toFixed(1) : 0, avgLatency: avgLatency.toFixed(0), byEndpoint };
  }
};

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID']
}));

app.use(express.json({ limit: '20mb' }));
app.use(morgan('combined'));

// ─── WSO2 API Manager Headers ─────────────────────────────────────────────────

app.use((req, res, next) => {
  req.requestId = uuidv4();
  req.startTime = Date.now();
  
  res.setHeader('X-WSO2-Gateway', 'FinAI-Enterprise-Gateway/1.0');
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-API-Version', 'v1');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  next();
});

// ─── API Analytics Middleware ──────────────────────────────────────────────────

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    const durationMs = Date.now() - req.startTime;
    analyticsStore.add({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.sub || 'anonymous',
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    return originalJson(data);
  };
  
  next();
});

// ─── Rate Limiting (WSO2 AM throttling simulation) ────────────────────────────

// Default rate limit
const defaultLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests — WSO2 API Manager throttling applied',
    retry_after: '60 seconds'
  },
  keyGenerator: (req) => req.user?.sub || req.ip
});

// AI endpoints — higher cost, lower limits
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // AI is expensive
  message: {
    error: 'AI rate limit exceeded',
    message: 'AI endpoint throttled — max 20 requests/minute',
    retry_after: '60 seconds'
  },
  keyGenerator: (req) => req.user?.sub || req.ip
});

// Report generation
const reportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: { error: 'Report limit exceeded', message: 'Max 5 reports per 5 minutes' }
});

// ─── JWT Validation Middleware (WSO2 IS token validation) ─────────────────────

const validateJWT = (req, res, next) => {
  // Skip auth for public routes
  const publicPaths = ['/api/v1/auth/login', '/api/v1/auth/register', '/health', '/gateway/health', '/gateway/analytics'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  
  // API Key authentication
  if (apiKey && apiKey === process.env.GATEWAY_API_KEY) {
    req.user = { sub: 'api-key-user', roles: ['normal_user'], auth_method: 'api_key' };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'authentication_required',
      message: 'Bearer token required — WSO2 Identity Server authentication',
      hint: 'Include Authorization: Bearer <token> header'
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY || 'your-super-secret-jwt-key-change-in-production');
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token_expired', message: 'JWT token expired — please refresh' });
    }
    return res.status(401).json({ error: 'invalid_token', message: 'Invalid JWT token' });
  }
};

// ─── RBAC Scope Validation (WSO2 AM scope check) ─────────────────────────────

const requireScope = (...requiredRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  const userRoles = req.user.roles || ['normal_user'];
  if (!requiredRoles.some(r => userRoles.includes(r))) {
    return res.status(403).json({
      error: 'insufficient_scope',
      message: `Required role: ${requiredRoles.join(' or ')}`,
      your_roles: userRoles
    });
  }
  next();
};

// ─── Service Configuration ────────────────────────────────────────────────────

const AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://localhost:8000';
const NODE_BACKEND_URL = process.env.NODE_BACKEND_URL || 'http://localhost:5000';

const proxyConfig = {
  changeOrigin: true,
  on: {
    proxyRes: (proxyRes, req) => {
      proxyRes.headers['X-Proxied-By'] = 'FinAI-WSO2-Gateway';
    },
    error: (err, req, res) => {
      console.error(`[Gateway] Proxy error: ${err.message}`);
      res.status(502).json({ error: 'service_unavailable', message: 'Backend service unavailable', service: err.message });
    }
  }
};

// ─── API Routes with Security & Rate Limiting ─────────────────────────────────

app.use(validateJWT);
app.use(defaultLimiter);

// Auth routes → AI Backend
app.use('/api/v1/auth', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));

// AI routes → FastAPI (with AI-specific rate limit + advisor scope on some)
app.use('/api/v1/ai', aiLimiter, createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/predictions', aiLimiter, createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/health-score', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/fraud', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));

// Core financial routes → AI Backend
app.use('/api/v1/income', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/expenses', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/budgets', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/savings', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/investments', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/analytics', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/reports', reportLimiter, createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/voice', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));
app.use('/api/v1/family', createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));

// Advisor portal → AI Backend (requires advisor role)
app.use('/api/v1/advisor', requireScope('financial_advisor', 'admin'), createProxyMiddleware({ target: AI_BACKEND_URL, ...proxyConfig }));

// Legacy Node.js routes → Node Backend
app.use('/api/market', createProxyMiddleware({ target: NODE_BACKEND_URL, ...proxyConfig }));
app.use('/api/insights', createProxyMiddleware({ target: NODE_BACKEND_URL, ...proxyConfig }));

// ─── Gateway Management APIs ──────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'FinAI Enterprise API Gateway',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    architecture: 'WSO2 API Manager Simulation',
    features: ['JWT Validation', 'Rate Limiting', 'API Analytics', 'RBAC', 'Proxy Routing']
  });
});

app.get('/gateway/health', (req, res) => {
  res.json({
    gateway: 'online',
    upstream_services: {
      ai_backend: AI_BACKEND_URL,
      node_backend: NODE_BACKEND_URL
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/gateway/analytics', (req, res) => {
  const summary = analyticsStore.getSummary();
  const recent = analyticsStore.requests.slice(-50).reverse();
  
  res.json({
    summary,
    recent_requests: recent.map(r => ({
      method: r.method,
      path: r.path,
      status: r.statusCode,
      duration_ms: r.durationMs,
      user: r.userId,
      timestamp: r.timestamp
    })),
    rate_limits: {
      default: '100 req/min',
      ai_endpoints: '20 req/min',
      reports: '5 req/5min'
    }
  });
});

// ─── Start Gateway ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║        FinAI Enterprise — WSO2 API Gateway           ║
║                                                      ║
║  🌐 Gateway Port:    ${PORT}                         ║
║  🤖 AI Backend:      ${AI_BACKEND_URL}    ║
║  📡 Node Backend:    ${NODE_BACKEND_URL}  ║
║                                                      ║
║  🔐 JWT Validation:   Active                         ║
║  ⚡ Rate Limiting:    Active (100 req/min)            ║
║  📊 API Analytics:    Active                         ║
║  🛡️  RBAC Scopes:     Active                         ║
╚══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
