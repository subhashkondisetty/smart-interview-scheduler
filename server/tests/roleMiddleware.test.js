const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const { authorize } = require('../middleware/auth');
const requireRole = require('../middleware/roleMiddleware');

describe('Role-based Authorization Middleware (requireRole)', () => {
  const secret = 'role_test_jwt_secret_key_12345678901234567890';
  let originalSecret;

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    process.env.JWT_EXPIRES_IN = '1h';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const generateTestUserAndToken = (id, email, role) => {
    const token = jwt.sign({ id, email, role }, secret, { expiresIn: '1h' });
    const userDoc = {
      _id: id,
      email,
      role,
      isActive: true,
      lastLogoutAt: null,
    };
    return { token, userDoc };
  };

  describe('GET /api/admin/ping (Admin-only route)', () => {
    test('candidate token hitting admin route returns 403', async () => {
      const { token, userDoc } = generateTestUserAndToken(
        '507f1f77bcf86cd799439011',
        'candidate@test.com',
        'candidate'
      );

      jest.spyOn(User, 'findById').mockResolvedValue(userDoc);

      const res = await request(app)
        .get('/api/admin/ping')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    test('admin token hitting admin route returns 200', async () => {
      const { token, userDoc } = generateTestUserAndToken(
        '507f1f77bcf86cd799439022',
        'admin@test.com',
        'admin'
      );

      jest.spyOn(User, 'findById').mockResolvedValue(userDoc);

      const res = await request(app)
        .get('/api/admin/ping')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Admin access confirmed');
      expect(res.body.data.role).toBe('admin');
    });

    test('no token hitting admin route returns 401', async () => {
      const res = await request(app).get('/api/admin/ping');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No authentication token provided/i);
    });
  });

  describe('GET /api/candidate/ping (Candidate-only route)', () => {
    test('candidate token hitting candidate route returns 200', async () => {
      const { token, userDoc } = generateTestUserAndToken(
        '507f1f77bcf86cd799439011',
        'candidate@test.com',
        'candidate'
      );

      jest.spyOn(User, 'findById').mockResolvedValue(userDoc);

      const res = await request(app)
        .get('/api/candidate/ping')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Candidate access confirmed');
      expect(res.body.data.role).toBe('candidate');
    });

    test('admin token hitting candidate-only route returns 403', async () => {
      const { token, userDoc } = generateTestUserAndToken(
        '507f1f77bcf86cd799439022',
        'admin@test.com',
        'admin'
      );

      jest.spyOn(User, 'findById').mockResolvedValue(userDoc);

      const res = await request(app)
        .get('/api/candidate/ping')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });
  });

  describe('Standalone authorize Middleware (server/middleware/auth.js)', () => {
    test('authorize permits user with matching role', () => {
      const middleware = authorize('admin');
      const req = { user: { role: 'admin' } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('authorize rejects user with non-matching role with 403', () => {
      const middleware = authorize('admin');
      const req = { user: { role: 'candidate' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
      expect(next).not.toHaveBeenCalled();
    });

    test('authorize rejects request without req.user with 403', () => {
      const middleware = authorize('admin');
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Standalone requireRole Middleware (server/middleware/roleMiddleware.js)', () => {
    test('requireRole rejects request without req.user with 401', () => {
      const middleware = requireRole('admin');
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Authentication required prior to role verification.',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Comprehensive Admin-Only Endpoints Protection', () => {
    test('rejects candidate token with 403 across admin routes', async () => {
      const { token, userDoc } = generateTestUserAndToken(
        '507f1f77bcf86cd799439011',
        'candidate@test.com',
        'candidate'
      );
      jest.spyOn(User, 'findById').mockResolvedValue(userDoc);

      const endpoints = [
        { method: 'get', path: '/api/admin/dashboard' },
        { method: 'post', path: '/api/admin/interview-slots' },
        { method: 'get', path: '/api/admin/interview-slots' },
        { method: 'get', path: '/api/admin/bookings' },
        { method: 'post', path: '/api/admin/assessments' },
        { method: 'get', path: '/api/admin/assessments' },
        { method: 'post', path: '/api/admin/notifications/broadcast' },
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      }
    });

    test('rejects unauthenticated requests with 401 across admin routes', async () => {
      const endpoints = [
        { method: 'get', path: '/api/admin/dashboard' },
        { method: 'get', path: '/api/admin/interview-slots' },
        { method: 'get', path: '/api/admin/bookings' },
        { method: 'get', path: '/api/admin/assessments' },
      ];

      for (const ep of endpoints) {
        const res = await request(app)[ep.method](ep.path);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      }
    });
  });
});
