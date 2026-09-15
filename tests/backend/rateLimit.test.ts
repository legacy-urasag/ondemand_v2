import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRateLimitStore, createRateLimiter } from '../../src/middleware/rateLimiter.js';

describe('Rate Limiter Middleware & Store', () => {
  it('increments hits and tracks remaining allowance within window', async () => {
    const store = new MemoryRateLimitStore();
    const key = 'test-client-1';
    const windowMs = 5000;

    const res1 = await store.increment(key, windowMs);
    assert.equal(res1.count, 1);

    const res2 = await store.increment(key, windowMs);
    assert.equal(res2.count, 2);

    const res3 = await store.increment(key, windowMs);
    assert.equal(res3.count, 3);
  });

  it('resets counters on store.reset', async () => {
    const store = new MemoryRateLimitStore();
    const key = 'test-client-reset';
    await store.increment(key, 5000);
    await store.increment(key, 5000);

    await store.reset(key);

    const next = await store.increment(key, 5000);
    assert.equal(next.count, 1);
  });

  it('middleware allows requests under limit and returns headers', async () => {
    const store = new MemoryRateLimitStore();
    const limiter = createRateLimiter({
      windowMs: 60000,
      max: 3,
      store,
      keyGenerator: () => 'ip-allowed-test',
    });

    let nextCalled = false;
    const headers: Record<string, any> = {};

    const req: any = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    const res: any = {
      setHeader: (k: string, v: any) => {
        headers[k] = v;
      },
      status: () => res,
      json: () => {},
    };

    await limiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, 'Next function must be called when under limit');
    assert.equal(headers['RateLimit-Limit'], 3);
    assert.equal(headers['RateLimit-Remaining'], 2);
  });

  it('middleware enforces 429 when max requests are exceeded', async () => {
    const store = new MemoryRateLimitStore();
    const limiter = createRateLimiter({
      windowMs: 60000,
      max: 2,
      store,
      keyGenerator: () => 'ip-blocked-test',
    });

    let statusCode = 200;
    let jsonBody: any = null;
    const headers: Record<string, any> = {};

    const createMockReqRes = () => {
      return {
        req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as any,
        res: {
          setHeader: (k: string, v: any) => {
            headers[k] = v;
          },
          status: (code: number) => {
            statusCode = code;
            return {
              json: (data: any) => {
                jsonBody = data;
              },
            };
          },
        } as any,
      };
    };

    // 1st request - ok
    const r1 = createMockReqRes();
    await limiter(r1.req, r1.res, () => {});

    // 2nd request - ok
    const r2 = createMockReqRes();
    await limiter(r2.req, r2.res, () => {});

    // 3rd request - should be rate-limited (429)
    let nextCalled = false;
    const r3 = createMockReqRes();
    await limiter(r3.req, r3.res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, 'Next must not be called when limit exceeded');
    assert.equal(statusCode, 429, 'Status code must be 429 Too Many Requests');
    assert.equal(jsonBody?.error?.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(headers['Retry-After'], 'Retry-After header must be set');
  });
});

