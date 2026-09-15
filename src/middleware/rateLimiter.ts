import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }>;
  reset(key: string): Promise<void>;
  clearAll?(): Promise<void>;
}

// In-memory sliding window store with active garbage collection
export class MemoryRateLimitStore implements RateLimitStore {
  private hits = new Map<string, { timestamps: number[] }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every 2 minutes to prevent memory leaks in production
    this.cleanupInterval = setInterval(() => this.cleanup(), 2 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.hits.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.hits.set(key, record);
    }

    // Keep only timestamps within the current sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
    record.timestamps.push(now);

    const oldest = record.timestamps[0];
    const ttlMs = Math.max(0, oldest + windowMs - now);

    return {
      count: record.timestamps.length,
      ttlMs,
    };
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  async clearAll(): Promise<void> {
    this.hits.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    // Default window cleanup threshold (1 hour)
    const expiryThreshold = now - 60 * 60 * 1000;
    for (const [key, record] of this.hits.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > expiryThreshold);
      if (record.timestamps.length === 0) {
        this.hits.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Distributed Redis-ready rate limit store adapter for multi-instance deployments
export class DistributedRateLimitStore implements RateLimitStore {
  private client: any;

  constructor(redisClient?: any) {
    this.client = redisClient;
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
    if (!this.client) {
      // Graceful fallback to memory store if Redis client is not initialized
      return defaultMemoryStore.increment(key, windowMs);
    }
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Multi/Exec pipeline in Redis
    const multi = this.client.multi();
    multi.zremrangebyscore(redisKey, 0, windowStart);
    multi.zadd(redisKey, now, `${now}-${Math.random()}`);
    multi.zcard(redisKey);
    multi.pexpire(redisKey, windowMs);
    const results = await multi.exec();

    const count = Number(results?.[2]?.[1] ?? 1);
    return { count, ttlMs: windowMs };
  }

  async reset(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(`ratelimit:${key}`);
    } else {
      await defaultMemoryStore.reset(key);
    }
  }
}

export const defaultMemoryStore = new MemoryRateLimitStore();

export function createStore(): RateLimitStore {
  if (env.RATE_LIMIT_STORAGE === 'redis') {
    return new DistributedRateLimitStore();
  }
  return defaultMemoryStore;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
  keyGenerator?: (req: Request) => string;
  store?: RateLimitStore;
}

// Extract client IP address securely
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    max,
    message = 'Túl sok kérés érkezett ebből a forrásból. Kérjük, próbálja újra később.',
    statusCode = 429,
    keyGenerator = (req) => `${req.baseUrl || ''}${req.path}:${getClientIp(req)}`,
    store = createStore(),
  } = options;

  return async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = keyGenerator(req);
    try {
      const { count, ttlMs } = await store.increment(key, windowMs);
      const remaining = Math.max(0, max - count);
      const retryAfterSeconds = Math.ceil(ttlMs / 1000);

      // Standard RateLimit headers
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);

      if (count > max) {
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(statusCode).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: retryAfterSeconds,
          },
        });
        return;
      }

      next();
    } catch (err) {
      // In production, do not block users if rate limiting store encounters an unexpected internal error
      console.error('Rate limiter internal error:', err);
      next();
    }
  };
}

// Pre-configured rate limiters per endpoint sensitivity
export const publicApiRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_PUBLIC,
  message: 'Túl sok publikus API kérés. Kérjük, várjon a következő próbálkozásig.',
});

export const formSubmissionRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_FORMS,
  message: 'Túl sok űrlap beküldés érkezett ebből az IP címből. Kérjük, várjon néhány percet a következő beküldés előtt.',
});

export const authRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_AUTH,
  message: 'Túl sok sikertelen bejelentkezési kísérlet. Biztonsági okokból a hozzáférés ideiglenesen korlátozva.',
});

