const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('User Model Unit Tests', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test_secret_for_user_model_tests';
    process.env.JWT_EXPIRES_IN = '1d';
  });

  test('default fields and validation structure', () => {
    const user = new User({
      email: 'candidate@test.com',
      password: 'mypassword123',
    });

    expect(user.role).toBe('candidate');
    expect(user.isActive).toBe(true);
    expect(user.lastLogoutAt).toBeNull();
  });

  test('comparePassword returns true for matching password and false for wrong password', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('correctPassword', salt);

    const user = new User({
      email: 'test@example.com',
      password: hashedPassword,
    });

    const isMatch = await user.comparePassword('correctPassword');
    const isMismatch = await user.comparePassword('wrongPassword');

    expect(isMatch).toBe(true);
    expect(isMismatch).toBe(false);
  });

  test('generateAuthToken generates valid JWT with id, email, and role', () => {
    const user = new User({
      email: 'candidate@domain.com',
      role: 'candidate',
    });

    const token = user.generateAuthToken();
    expect(token).toBeDefined();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(user._id.toString());
    expect(decoded.email).toBe('candidate@domain.com');
    expect(decoded.role).toBe('candidate');
  });
});
