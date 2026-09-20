const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const interviewSlotRoutes = require('./routes/interviewSlotRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const errorHandler = require('./middleware/errorHandler');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swaggerSpec');

const app = express();

// Trust reverse proxy (Render, Heroku, AWS ALB, Cloudflare) for accurate client IP in rate limiting
app.set('trust proxy', 1);

// 1. Security HTTP Headers
app.use(helmet());

// 2. Cross-Origin Resource Sharing (CORS) Configuration
const getProductionOrigins = () => {
  if (!process.env.CLIENT_URL) return [];
  return process.env.CLIENT_URL.split(',').map((u) => u.trim()).filter(Boolean);
};

const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? getProductionOrigins()
    : [...new Set([...devOrigins, ...getProductionOrigins()])];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'test') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Date'],
  })
);

// 3. Body Parsing with Payload Size Limits (DoS mitigation)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. NoSQL Query Injection Sanitizer
// Recursively strips keys starting with '$' or containing '.' from req.body, req.query, and req.params
const sanitizeNoSQL = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
};
app.use(sanitizeNoSQL);

// 5. Rate Limiting Configuration
// General API Rate Limiter: 100 requests per 15 minutes in production, 1000 in dev
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});
app.use('/api', generalLimiter);

// Strict Authentication Limiter: 50 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Dedicated File Upload Rate Limiter: 20 uploads per 15 minutes per IP
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many upload attempts from this IP, please try again later.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});
app.use('/api/candidate/profile/resume', uploadLimiter);

// 6. Swagger / OpenAPI Documentation (Scoped CSP Relaxation & Production Gating)
const isSwaggerEnabled = () => process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true';

const swaggerCsp = helmet.contentSecurityPolicy({
  directives: {
    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:'],
  },
});

const swaggerRouter = express.Router();
swaggerRouter.use((req, res, next) => {
  if (!isSwaggerEnabled()) {
    return res.status(404).json({
      success: false,
      message: 'Documentation not available in production',
    });
  }
  swaggerCsp(req, res, next);
});
swaggerRouter.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api-docs', swaggerRouter);

app.get('/api-docs.json', (req, res, next) => {
  if (!isSwaggerEnabled()) {
    return res.status(404).json({
      success: false,
      message: 'Documentation not available in production',
    });
  }
  swaggerCsp(req, res, () => res.json(swaggerSpec));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/candidate', candidateRoutes);
app.use('/api/interview-slots', interviewSlotRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/notifications', notificationRoutes);

app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Smart Interview Scheduler API is running' });
});

// 404 Handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
