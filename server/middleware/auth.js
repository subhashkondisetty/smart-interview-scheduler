const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - Verifies JWT and attaches authenticated user to req.user.
 * Also enforces token invalidation if user logged out after token was issued.
 */
const authenticate = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_min_32_chars';
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Token invalidation check: Reject tokens issued before user's last logout timestamp
    if (user.lastLogoutAt) {
      const tokenIssuedAtMs = decoded.iat * 1000;
      const lastLogoutAtMs = new Date(user.lastLogoutAt).getTime();
      if (tokenIssuedAtMs < lastLogoutAtMs) {
        return res.status(401).json({
          success: false,
          message: 'Token has been invalidated by logout. Please log in again.',
        });
      }
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.',
    });
  }
};

/**
 * Role-based authorization middleware.
 * Restricts access to users having one of the specified roles.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to perform this action.',
      });
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
