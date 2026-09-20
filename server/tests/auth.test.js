const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');

describe('Auth API Endpoints (POST /register, POST /login, POST /logout, GET /me)', () => {
  const secret = 'test_jwt_secret_key_12345678901234567890';
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

  describe('POST /api/auth/register', () => {
    test('should register a new candidate successfully', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      const fakeUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: 'candidate',
        isActive: true,
        generateAuthToken: function () {
          return jwt.sign({ id: this._id, email: this.email, role: this.role }, secret, {
            expiresIn: '1h',
          });
        },
        toJSON: function () {
          return {
            _id: this._id,
            email: this.email,
            role: this.role,
            isActive: this.isActive,
          };
        },
      };

      jest.spyOn(User, 'create').mockResolvedValue(fakeUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.user.role).toBe('candidate');
      expect(res.body.data).toHaveProperty('token');
    });

    test('should strictly enforce candidate role even if admin role is passed in registration payload', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      const createSpy = jest.spyOn(User, 'create').mockImplementation(async (userData) => ({
        _id: '507f1f77bcf86cd799439011',
        ...userData,
        isActive: true,
        generateAuthToken: () => jwt.sign({ id: '507f1f77bcf86cd799439011', role: userData.role }, secret),
        toJSON: () => ({ _id: '507f1f77bcf86cd799439011', email: userData.email, role: userData.role, isActive: true }),
      }));

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'hacker@example.com', password: 'password123', role: 'admin' });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ role: 'candidate' }));
      expect(res.body.data.user.role).toBe('candidate');
    });

    test('should normalize email by trimming and converting to lowercase', async () => {
      const findSpy = jest.spyOn(User, 'findOne').mockResolvedValue(null);
      const createSpy = jest.spyOn(User, 'create').mockImplementation(async (userData) => ({
        _id: '507f1f77bcf86cd799439011',
        ...userData,
        isActive: true,
        generateAuthToken: () => jwt.sign({ id: '507f1f77bcf86cd799439011', role: userData.role }, secret),
        toJSON: () => ({ _id: '507f1f77bcf86cd799439011', email: userData.email, role: userData.role, isActive: true }),
      }));

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: '   TestUser@EXAMPLE.com   ', password: 'password123' });

      expect(res.status).toBe(201);
      expect(findSpy).toHaveBeenCalledWith({ email: 'testuser@example.com' });
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ email: 'testuser@example.com' }));
    });

    test('should fail with 400 when email already exists', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({ _id: '123', email: 'test@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('User already exists with this email');
    });

    test('should fail with 400 when invalid payload is sent', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid-email', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Please provide a valid email address');
      expect(res.body.errors).toContain('Password must be at least 6 characters long');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login successfully with correct credentials', async () => {
      const fakeUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'candidate@example.com',
        role: 'candidate',
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
        generateAuthToken: function () {
          return jwt.sign({ id: this._id, email: this.email, role: this.role }, secret, {
            expiresIn: '1h',
          });
        },
        toJSON: function () {
          return {
            _id: this._id,
            email: this.email,
            role: this.role,
            isActive: this.isActive,
          };
        },
      };

      const selectMock = jest.fn().mockResolvedValue(fakeUser);
      jest.spyOn(User, 'findOne').mockReturnValue({ select: selectMock });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'candidate@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('candidate@example.com');
      expect(res.body.data).toHaveProperty('token');
      expect(fakeUser.comparePassword).toHaveBeenCalledWith('password123');
    });

    test('should fail with 401 when password is wrong', async () => {
      const fakeUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'candidate@example.com',
        role: 'candidate',
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      const selectMock = jest.fn().mockResolvedValue(fakeUser);
      jest.spyOn(User, 'findOne').mockReturnValue({ select: selectMock });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'candidate@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    test('should fail with 401 when user does not exist', async () => {
      const selectMock = jest.fn().mockResolvedValue(null);
      jest.spyOn(User, 'findOne').mockReturnValue({ select: selectMock });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    test('should fail with 403 when user account is deactivated', async () => {
      const inactiveUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'deactivated@example.com',
        role: 'candidate',
        isActive: false,
      };

      const selectMock = jest.fn().mockResolvedValue(inactiveUser);
      jest.spyOn(User, 'findOne').mockReturnValue({ select: selectMock });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'deactivated@example.com', password: 'password123' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/account has been deactivated/i);
    });

    test('should fail with 400 when email or password is missing in login payload', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Email is required');
      expect(res.body.errors).toContain('Password is required');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should fail with 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No authentication token provided/i);
    });

    test('should fail with 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid authentication token.');
    });

    test('should return current user when valid token is provided', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign({ id: userId, email: 'me@example.com', role: 'candidate' }, secret, {
        expiresIn: '1h',
      });

      const fakeUser = {
        _id: userId,
        email: 'me@example.com',
        role: 'candidate',
        isActive: true,
        lastLogoutAt: null,
      };

      jest.spyOn(User, 'findById').mockResolvedValue(fakeUser);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user._id).toBe(userId);
      expect(res.body.data.user.email).toBe('me@example.com');
    });

    test('should fail with 401 if user logged out after token was issued', async () => {
      const userId = '507f1f77bcf86cd799439011';
      // Issue token with past iat
      const issuedAtSeconds = Math.floor(Date.now() / 1000) - 60; // 60s ago
      const token = jwt.sign(
        { id: userId, email: 'me@example.com', role: 'candidate', iat: issuedAtSeconds },
        secret
      );

      const fakeUser = {
        _id: userId,
        email: 'me@example.com',
        role: 'candidate',
        isActive: true,
        lastLogoutAt: new Date(), // logged out now (after token was issued)
      };

      jest.spyOn(User, 'findById').mockResolvedValue(fakeUser);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Token has been invalidated by logout/i);
    });

    test('should fail with 401 when token user no longer exists in database', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign({ id: userId, email: 'deleted@example.com', role: 'candidate' }, secret, {
        expiresIn: '1h',
      });

      jest.spyOn(User, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/no longer exists/i);
    });

    test('should fail with 403 when authenticated user account is deactivated', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign({ id: userId, email: 'deactivated@example.com', role: 'candidate' }, secret, {
        expiresIn: '1h',
      });

      const inactiveUser = {
        _id: userId,
        email: 'deactivated@example.com',
        role: 'candidate',
        isActive: false,
      };

      jest.spyOn(User, 'findById').mockResolvedValue(inactiveUser);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/account has been deactivated/i);
    });

    test('should fail with 401 when authentication token has expired', async () => {
      const expiredToken = jwt.sign(
        { id: '507f1f77bcf86cd799439011', email: 'expired@example.com', role: 'candidate' },
        secret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/token has expired/i);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should log out user and update lastLogoutAt', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = jwt.sign({ id: userId, email: 'logout@example.com', role: 'candidate' }, secret, {
        expiresIn: '1h',
      });

      const fakeUser = {
        _id: userId,
        email: 'logout@example.com',
        role: 'candidate',
        isActive: true,
        lastLogoutAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findById').mockResolvedValue(fakeUser);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');
      expect(fakeUser.save).toHaveBeenCalled();
      expect(fakeUser.lastLogoutAt).toBeInstanceOf(Date);
    });
  });

  describe('PUT /api/auth/update-password', () => {
    const userId = '507f1f77bcf86cd799439011';
    const token = jwt.sign({ id: userId, email: 'updatepw@example.com', role: 'candidate' }, secret, {
      expiresIn: '1h',
    });

    const mockUserFindById = (overrides = {}) => {
      const u = {
        _id: userId,
        email: 'updatepw@example.com',
        role: 'candidate',
        isActive: true,
        lastLogoutAt: null,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        generateAuthToken: () => jwt.sign({ id: userId, email: 'updatepw@example.com', role: 'candidate' }, secret),
        ...overrides,
      };
      jest.spyOn(User, 'findById').mockImplementation(() => {
        const query = Promise.resolve(u);
        query.select = jest.fn().mockReturnValue(Promise.resolve(u));
        return query;
      });
      return u;
    };

    test('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .put('/api/auth/update-password')
        .send({ currentPassword: 'OldPassword1!', newPassword: 'NewPassword2!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should validate input payload (min 8 chars, distinct passwords)', async () => {
      mockUserFindById();

      const res = await request(app)
        .put('/api/auth/update-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPassword1!', newPassword: 'OldPassword1!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('New password must be different from current password');
    });

    test('should reject when current password does not match with 401', async () => {
      mockUserFindById({
        comparePassword: jest.fn().mockResolvedValue(false),
      });

      const res = await request(app)
        .put('/api/auth/update-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongCurrentPassword!', newPassword: 'NewPassword2!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/current password is incorrect/i);
    });

    test('should successfully update password and issue fresh JWT', async () => {
      const fakeUser = mockUserFindById();

      const res = await request(app)
        .put('/api/auth/update-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPassword1!', newPassword: 'NewPassword2!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/password updated successfully/i);
      expect(fakeUser.password).toBe('NewPassword2!');
      expect(fakeUser.save).toHaveBeenCalled();
      expect(res.body.data).toHaveProperty('token');
    });
  });
});
