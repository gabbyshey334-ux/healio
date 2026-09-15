/**
 * Auth middleware — requires a valid Bearer JWT.
 * Optionally restrict to one or more roles: requireAuth('admin'), requireAuth('doctor', 'admin')
 */

import { verifyToken } from '../utils/jwt.js';

export function requireAuth(...allowedRoles) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = header.slice(7);
    try {
      const decoded = verifyToken(token);
      req.user = decoded; // { id, role, email }

      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden for this role' });
      }

      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
