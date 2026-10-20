/**
 * Authentication and Role-Based Access Control (RBAC) Middleware
 *
 * Rules from assignment:
 * - Unauthenticated requests: HTTP 401
 * - Authenticated users with the wrong role: HTTP 403
 * - Customers attempting to access another customer's individual record: HTTP 404
 * - Never trust user IDs or roles sent in request bodies; derive exclusively from session.
 */

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({
      error: 'Authentication required. Please log in.'
    });
  }
  // Attach user convenience reference from server session
  req.user = req.session.user;
  next();
}

function requireRole(requiredRole) {
  return (req, res, next) => {
    // Ensure authenticated first
    if (!req.session || !req.session.user || !req.session.user.id) {
      return res.status(401).json({
        error: 'Authentication required. Please log in.'
      });
    }

    if (req.session.user.role !== requiredRole) {
      return res.status(403).json({
        error: `Access forbidden. This action requires the '${requiredRole}' role.`
      });
    }

    req.user = req.session.user;
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
