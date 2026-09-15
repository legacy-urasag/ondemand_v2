import type { Request, Response, NextFunction } from 'express';
import { authService, type TokenPayload, type UserRole } from '../services/authService.js';

// Extend Express Request with authenticated user payload
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// Middleware: Authenticate Bearer JWT
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Hitelesítés szükséges a végpont eléréséhez.',
      },
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_AUTH_HEADER',
        message: 'Érvénytelen formátumú Authorization fejléc (Bearer <token> szükséges).',
      },
    });
    return;
  }

  const token = parts[1];
  const result = authService.verifyToken(token);

  if (!result.valid || !result.payload) {
    const message =
      result.reason === 'TOKEN_EXPIRED'
        ? 'A munkamenet lejárt. Kérjük, jelentkezzen be újra.'
        : 'Érvénytelen vagy módosított hitelesítési token.';

    res.status(401).json({
      success: false,
      error: {
        code: result.reason || 'TOKEN_INVALID',
        message,
      },
    });
    return;
  }

  req.user = result.payload;
  next();
}

// Middleware: Enforce Role-Based Access Control (RBAC)
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Hitelesítés szükséges a művelethez.',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Nincs jogosultsága az adott erőforrás vagy művelet eléréséhez.',
          requiredRoles: allowedRoles,
          currentRole: req.user.role,
        },
      });
      return;
    }

    next();
  };
}

