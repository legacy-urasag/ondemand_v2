import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export interface CorsOptions {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  allowCredentials?: boolean;
}

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'];
const DEFAULT_EXPOSED_HEADERS = [
  'RateLimit-Limit',
  'RateLimit-Remaining',
  'RateLimit-Reset',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'Retry-After',
];

export function createCorsMiddleware(options?: CorsOptions) {
  const allowedOrigins = options?.allowedOrigins ?? env.getAllowedOrigins();
  const allowedMethods = options?.allowedMethods ?? DEFAULT_METHODS;
  const allowedHeaders = options?.allowedHeaders ?? DEFAULT_HEADERS;
  const exposedHeaders = options?.exposedHeaders ?? DEFAULT_EXPOSED_HEADERS;
  const maxAge = options?.maxAge ?? 86400; // 24 hours
  const allowCredentials = options?.allowCredentials ?? true;

  return function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;

    // Always vary on Origin header for cache safety
    res.setHeader('Vary', 'Origin');

    if (!origin) {
      // Same-origin, direct server-to-server, or local CLI requests
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      return next();
    }

    const isOriginAllowed = allowedOrigins.includes(origin);

    if (isOriginAllowed) {
      // Strict matching - NEVER set wildcard '*' when credentials or auth are present
      res.setHeader('Access-Control-Allow-Origin', origin);
      if (allowCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
      res.setHeader('Access-Control-Max-Age', maxAge.toString());

      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    } else {
      // Origin is not allowed
      if (req.method === 'OPTIONS') {
        res.status(403).json({
          success: false,
          error: {
            code: 'CORS_NOT_ALLOWED',
            message: `A megadott Origin ('${origin}') nincs engedélyezve a szerveren.`,
          },
        });
        return;
      }
    }

    next();
  };
}

export const corsMiddleware = createCorsMiddleware();

