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
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const crypto = require('crypto');
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

app.set('trust proxy', 1); // behind Vercel / load balancer: real client IP for rate limiting

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173', 'https://ravindu-vs.github.io'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID']
}));

// Request bodies are NOT parsed here: they are streamed unchanged to the upstream service.
// (Parsing would consume the stream and break proxied POST/PUT bodies.)
app.use(morgan(process.env.VERCEL ? 'tiny' : 'combined'));

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

// Firebase ID tokens (the PWA's identity provider, RS256) — Google rotates keys; cache them.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'financeflow-a6aa0';
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = { certs: {}, expires: 0 };
async function firebaseCerts(force = false) {
  if (!force && Date.now() < certCache.expires && Object.keys(certCache.certs).length) return certCache.certs;
  const r = await fetch(FIREBASE_CERTS_URL);
  if (!r.ok) throw new Error(`cert fetch ${r.status}`);
  const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  certCache = { certs: await r.json(), expires: Date.now() + (m ? Number(m[1]) : 3600) * 1000 };
  return certCache.certs;
}
// Test hook only (never set in production): inject signing keys instead of fetching Google's.
if (process.env.NODE_ENV === 'test') app.__setFirebaseCerts = certs => { certCache = { certs, expires: Date.now() + 3600e3 } }

async function verifyFirebase(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded) throw new Error('malformed');
  let certs = await firebaseCerts();
  if (!certs[decoded.header.kid]) certs = await firebaseCerts(true);
  const cert = certs[decoded.header.kid];
  if (!cert) throw new Error('unknown key');
  return jwt.verify(token, cert, {
    algorithms: ['RS256'], audience: FIREBASE_PROJECT_ID, issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
  });
}

const validateJWT = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  // Skip auth for public routes
  const publicPaths = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh', '/health', '/gateway/health', '/gateway/analytics'];
  if (req.path === '/' || publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  // API Key authentication (constant-time compare)
  if (apiKey && process.env.GATEWAY_API_KEY && apiKey.length === process.env.GATEWAY_API_KEY.length &&
      crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(process.env.GATEWAY_API_KEY))) {
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
  const header = (jwt.decode(token, { complete: true }) || {}).header || {};

  try {
    if (header.alg === 'RS256') {
      const claims = await verifyFirebase(token);
      req.user = { sub: claims.sub, email: claims.email, roles: ['normal_user'], auth_method: 'firebase' };
    } else {
      if (!process.env.JWT_SECRET_KEY) throw new Error('local JWT disabled');
      req.user = { ...jwt.verify(token, process.env.JWT_SECRET_KEY, { algorithms: ['HS256'] }), auth_method: 'jwt' };
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token_expired', message: 'JWT token expired — please refresh' });
    }
    return res.status(401).json({ error: 'invalid_token', message: 'Invalid or untrusted token' });
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

// One proxy for all /api/v1 traffic. pathFilter keeps the full original path
// (app.use('/prefix', proxy) would strip the prefix before forwarding).
const backendProxy = createProxyMiddleware({
  target: AI_BACKEND_URL,
  changeOrigin: true,
  pathFilter: '/api/v1',
  proxyTimeout: 55000,
  on: {
    proxyReq: (proxyReq, req) => {
      fixRequestBody(proxyReq, req);
      proxyReq.setHeader('X-Request-ID', req.requestId);
      if (req.user?.sub) proxyReq.setHeader('X-Gateway-User', req.user.sub);
    },
    proxyRes: (proxyRes, req) => {
      proxyRes.headers['X-Proxied-By'] = 'FinAI-WSO2-Gateway';
      analyticsStore.add({ requestId: req.requestId, method: req.method, path: req.originalUrl.split('?')[0], statusCode: proxyRes.statusCode, durationMs: Date.now() - req.startTime, userId: req.user?.sub || 'anonymous' });
    },
    error: (err, req, res) => {
      console.error(`[Gateway] Proxy error: ${err.message}`);
      if (!res.headersSent) res.status(502).json({ error: 'service_unavailable', message: 'Backend service unavailable' });
    }
  }
});

// ─── API Routes with Security & Rate Limiting ─────────────────────────────────

app.use(validateJWT);
app.use('/api/v1', defaultLimiter);
app.use(['/api/v1/ai', '/api/v1/predictions'], aiLimiter);
app.use('/api/v1/reports', reportLimiter);
app.use('/api/v1/advisor', requireScope('financial_advisor', 'admin'));
app.use(backendProxy);

// ─── Gateway Management APIs ──────────────────────────────────────────────────

async function probe(url, timeoutMs = 15000) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const body = await r.json().catch(() => ({}));
    return { status: r.ok ? 'online' : 'degraded', http: r.status, latency_ms: Date.now() - t0, body };
  } catch (e) {
    return { status: 'offline', error: e.name === 'TimeoutError' ? 'timeout' : e.message, latency_ms: Date.now() - t0 };
  }
}

const gatewayInfo = () => ({
  status: 'online',
  service: 'FinAI Enterprise API Gateway',
  version: '1.1.0',
  uptime: Math.floor(process.uptime()),
  architecture: 'WSO2 API Manager pattern (Node gateway)',
  features: ['Firebase + JWT validation', 'Rate limiting', 'API analytics', 'RBAC', 'Proxy routing'],
});

app.get('/', (req, res) => res.json(gatewayInfo()));
app.get('/health', (req, res) => res.json(gatewayInfo()));

// Real end-to-end status: gateway → backend → database / LLM
app.get('/gateway/health', async (req, res) => {
  const backend = await probe(`${AI_BACKEND_URL}/health`);
  const comps = backend.body?.components || {};
  res.json({
    gateway: { status: 'online', version: '1.1.0' },
    ai_backend: { status: backend.status, latency_ms: backend.latency_ms, error: backend.error },
    database: comps.database || { status: backend.status === 'offline' ? 'unknown' : 'offline' },
    llm: comps.llm || { status: 'unknown' },
    auth: { status: 'online', provider: 'Firebase Authentication', project: FIREBASE_PROJECT_ID },
    rate_limiting: { status: 'online', store: 'in-memory per instance' },
    timestamp: new Date().toISOString(),
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

// ─── Start Gateway (local) / export for serverless (Vercel) ───────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`FinAI Gateway on :${PORT} → AI backend ${AI_BACKEND_URL}`);
  });
}

module.exports = app;
