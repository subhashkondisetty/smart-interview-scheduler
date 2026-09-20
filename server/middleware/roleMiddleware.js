/**
 * Role-based authorization middleware factory.
 * Enforces role access control following successful authentication.
 *
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'candidate')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required prior to role verification.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to access this resource.',
      });
    }

    next();
  };
};

module.exports = requireRole;
