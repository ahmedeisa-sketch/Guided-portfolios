import { verifyAccessToken } from '../utils/tokens.js';
import { HttpError } from '../utils/http.js';

export function authenticate(req, _res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(new HttpError(401, 'Authentication required', 'AUTH_REQUIRED'));

  try {
    const payload = verifyAccessToken(match[1]);
    if (payload.type !== 'access') throw new Error('Invalid token type');
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired access token', 'INVALID_TOKEN'));
  }
}

export function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    return next();
  };
}
