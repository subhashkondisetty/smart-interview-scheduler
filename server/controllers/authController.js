const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');

// PII sanitization helper for structured logging
const maskEmail = (email) =>
  email ? email.replace(/^(.)(.*)(@.*)$/, (_, f, m, d) => `${f}${'*'.repeat(Math.min(m.length, 5))}${d}`) : '';

/**
 * @desc    Register a new candidate user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email',
    });
  }

  // Create user - candidates are always created with role 'candidate'
  const user = await User.create({
    email: normalizedEmail,
    password,
    role: 'candidate',
  });

  const token = user.generateAuthToken();

  // Non-blocking fault-tolerant welcome email dispatch
  emailService.sendWelcomeEmail(user).catch((err) => {
    console.error(`[Auth] Failed to send welcome email to ${maskEmail(user.email)}:`, err.message);
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user,
      token,
    },
  });
});

/**
 * @desc    Authenticate user & return JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  // Explicitly select password field
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been deactivated. Please contact support.',
    });
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  const token = user.generateAuthToken();

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: {
      user,
      token,
    },
  });
});

/**
 * @desc    Logout user & invalidate current/prior tokens
 * @route   POST /api/auth/logout
 * @access  Private (authenticated user)
 */
const logout = asyncHandler(async (req, res) => {
  // Token Invalidation Strategy:
  // Update lastLogoutAt on the user record. Any token with iat older than this timestamp
  // is rejected by authenticate middleware.
  req.user.lastLogoutAt = new Date();
  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (authenticated user)
 */
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Current user profile retrieved',
    data: {
      user: req.user,
    },
  });
});

/**
 * @desc    Request password reset email (Generic anti-enumeration response)
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const genericMessage = 'If an account exists for this email, a reset link has been sent.';

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    // Anti-enumeration: Return generic 200 without leaking account absence
    return res.status(200).json({
      success: true,
      message: genericMessage,
    });
  }

  // Generate unhashed reset token (32 bytes hex string)
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Compute SHA-256 hash for database storage
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Set hashed token and 15-minute expiration
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  // Generate reset URL for email
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

  // Non-blocking fault-tolerant email dispatch
  emailService.sendPasswordResetEmail(user, resetUrl).catch((err) => {
    console.error(`[Auth] Failed to send password reset email to ${maskEmail(user.email)}:`, err.message);
  });

  res.status(200).json({
    success: true,
    message: genericMessage,
  });
});

/**
 * @desc    Reset password using valid reset token
 * @route   PUT /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Compute SHA-256 hash of provided raw token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Explicitly select resetPasswordToken and resetPasswordExpire because schema has select: false
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+password +resetPasswordToken +resetPasswordExpire');

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired password reset token',
    });
  }

  // Update password (pre-save hook will hash it)
  user.password = password;

  // Single-use token: clear fields on user record
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. You can now log in with your new password.',
  });
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};
