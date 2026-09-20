const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const emailService = require('../services/emailService');

describe('Password Reset Endpoints (POST /forgot-password, PUT /reset-password/:token)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const genericResponseMsg = 'If an account exists for this email, a reset link has been sent.';

  const createQueryMock = (result) => ({
    select: jest.fn().mockResolvedValue(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  });

  describe('POST /api/auth/forgot-password', () => {
    test('1. Returns generic 200 response when email exists, generates hashed token with 15m expiry, and calls sendPasswordResetEmail', async () => {
      const email = 'candidate@test.com';
      const fakeUser = {
        _id: '507f1f77bcf86cd799439011',
        email,
        role: 'candidate',
        isActive: true,
        resetPasswordToken: undefined,
        resetPasswordExpire: undefined,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockImplementation(() => createQueryMock(fakeUser));
      const emailSpy = jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(genericResponseMsg);

      // Verify token generation and 15-minute expiration
      expect(fakeUser.save).toHaveBeenCalled();
      expect(fakeUser.resetPasswordToken).toBeDefined();
      expect(typeof fakeUser.resetPasswordToken).toBe('string');
      expect(fakeUser.resetPasswordToken.length).toBe(64); // SHA-256 hex string is 64 chars

      expect(fakeUser.resetPasswordExpire).toBeInstanceOf(Date);
      const expireTime = fakeUser.resetPasswordExpire.getTime();
      const expectedMinTime = Date.now() + 14 * 60 * 1000;
      const expectedMaxTime = Date.now() + 16 * 60 * 1000;
      expect(expireTime).toBeGreaterThanOrEqual(expectedMinTime);
      expect(expireTime).toBeLessThanOrEqual(expectedMaxTime);

      // Verify email dispatch
      expect(emailSpy).toHaveBeenCalledWith(fakeUser, expect.stringContaining('/reset-password/'));
    });

    test('2. Anti-enumeration: Returns identical generic 200 response when email does not exist and does NOT send email', async () => {
      jest.spyOn(User, 'findOne').mockImplementation(() => createQueryMock(null));
      const emailSpy = jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(genericResponseMsg);

      // Verify NO email is sent when user doesn't exist
      expect(emailSpy).not.toHaveBeenCalled();
    });

    test('3. Validation error on invalid or missing email format', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email-format' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Please provide a valid email address');
    });
  });

  describe('PUT /api/auth/reset-password/:token', () => {
    test('4. Succeeds with valid unexpired token, updates password, allows subsequent login with new password, and rejects old password', async () => {
      const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      const oldHashedPassword = await bcrypt.hash('oldPassword123', 10);
      let storedPasswordHash = oldHashedPassword;

      const fakeUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'user@test.com',
        password: oldHashedPassword,
        role: 'candidate',
        isActive: true,
        resetPasswordToken: hashedToken,
        resetPasswordExpire: new Date(Date.now() + 10 * 60 * 1000),
        save: jest.fn().mockImplementation(async function () {
          // Simulate Mongoose pre-save hashing
          storedPasswordHash = await bcrypt.hash(this.password, 10);
          return true;
        }),
        comparePassword: async function (candidatePassword) {
          return bcrypt.compare(candidatePassword, storedPasswordHash);
        },
      };

      const findSpy = jest.spyOn(User, 'findOne').mockImplementation((query) => {
        if (query.resetPasswordToken === hashedToken) {
          return createQueryMock(fakeUser);
        }
        return createQueryMock(null);
      });

      const res = await request(app)
        .put(`/api/auth/reset-password/${rawToken}`)
        .send({ password: 'newPassword123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/password reset successfully/i);

      // Verify password was updated
      expect(fakeUser.save).toHaveBeenCalled();
      const isNewPasswordValid = await fakeUser.comparePassword('newPassword123');
      const isOldPasswordValid = await fakeUser.comparePassword('oldPassword123');
      expect(isNewPasswordValid).toBe(true);
      expect(isOldPasswordValid).toBe(false);
    });

    test('5. Rejects expired token with 400 Bad Request', async () => {
      const rawToken = 'expired-token-12345';
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      // findOne returns null when token is expired because query filters { resetPasswordExpire: { $gt: Date.now() } }
      jest.spyOn(User, 'findOne').mockImplementation(() => createQueryMock(null));

      const res = await request(app)
        .put(`/api/auth/reset-password/${rawToken}`)
        .send({ password: 'newPassword123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or expired/i);
    });

    test('6. Rejects malformed or nonexistent token with 400 Bad Request', async () => {
      jest.spyOn(User, 'findOne').mockImplementation(() => createQueryMock(null));

      const res = await request(app)
        .put('/api/auth/reset-password/completely-bogus-token')
        .send({ password: 'newPassword123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or expired/i);
    });

    test('7. Single-use enforcement: Token fields are cleared on save and subsequent reuse attempt fails', async () => {
      const rawToken = 'single-use-token-abcdef';
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      let tokenCleared = false;
      const fakeUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'singleuse@test.com',
        role: 'candidate',
        resetPasswordToken: hashedToken,
        resetPasswordExpire: new Date(Date.now() + 10 * 60 * 1000),
        save: jest.fn().mockImplementation(async function () {
          if (this.resetPasswordToken === undefined && this.resetPasswordExpire === undefined) {
            tokenCleared = true;
          }
          return true;
        }),
      };

      jest.spyOn(User, 'findOne').mockImplementation(() => {
        if (!tokenCleared) {
          return createQueryMock(fakeUser);
        }
        // Once cleared, subsequent findOne by token returns null
        return createQueryMock(null);
      });

      // First reset attempt succeeds
      const firstRes = await request(app)
        .put(`/api/auth/reset-password/${rawToken}`)
        .send({ password: 'firstNewPassword123' });

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.success).toBe(true);
      expect(tokenCleared).toBe(true);
      expect(fakeUser.resetPasswordToken).toBeUndefined();
      expect(fakeUser.resetPasswordExpire).toBeUndefined();

      // Second reset attempt with identical token MUST fail
      const secondRes = await request(app)
        .put(`/api/auth/reset-password/${rawToken}`)
        .send({ password: 'secondNewPassword123' });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.message).toMatch(/invalid or expired/i);
    });

    test('8. Validation error on password shorter than 6 characters', async () => {
      const res = await request(app)
        .put('/api/auth/reset-password/some-token')
        .send({ password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('Password must be at least 6 characters long');
    });
  });
});
