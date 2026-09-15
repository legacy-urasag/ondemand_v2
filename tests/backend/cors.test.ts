import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCorsMiddleware } from '../../src/middleware/cors.js';

describe('CORS Middleware', () => {
  const allowedOrigins = ['http://localhost:3000', 'https://ondemand.hu'];
  const cors = createCorsMiddleware({ allowedOrigins });

  it('sets strict Access-Control-Allow-Origin for whitelisted origin', () => {
    const headers: Record<string, string> = {};
    let nextCalled = false;

    const req: any = {
      method: 'GET',
      headers: { origin: 'https://ondemand.hu' },
    };
    const res: any = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      status: () => res,
      end: () => {},
    };

    cors(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(headers['Access-Control-Allow-Origin'], 'https://ondemand.hu');
    assert.notEqual(headers['Access-Control-Allow-Origin'], '*', 'Must never return wildcard origin');
    assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
    assert.equal(headers['Vary'], 'Origin');
  });

  it('does NOT set Access-Control-Allow-Origin for unlisted origin', () => {
    const headers: Record<string, string> = {};
    let nextCalled = false;

    const req: any = {
      method: 'GET',
      headers: { origin: 'https://malicious-site.com' },
    };
    const res: any = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      status: () => res,
      end: () => {},
    };

    cors(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(headers['Access-Control-Allow-Origin'], undefined);
  });

  it('handles preflight OPTIONS requests for allowed origins with 204 No Content', () => {
    let statusCode = 0;
    let endCalled = false;
    const headers: Record<string, string> = {};

    const req: any = {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    };
    const res: any = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      end: () => {
        endCalled = true;
      },
    };

    cors(req, res, () => {});

    assert.equal(statusCode, 204);
    assert.equal(endCalled, true);
    assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:3000');
    assert.ok(headers['Access-Control-Allow-Methods'].includes('POST'));
    assert.ok(headers['Access-Control-Max-Age']);
  });

  it('rejects preflight OPTIONS for disallowed origin with 403 Forbidden', () => {
    let statusCode = 0;
    let jsonBody: any = null;

    const req: any = {
      method: 'OPTIONS',
      headers: { origin: 'https://evil-phishing.com' },
    };
    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
      },
      end: () => {},
    };

    cors(req, res, () => {});

    assert.equal(statusCode, 403);
    assert.equal(jsonBody?.error?.code, 'CORS_NOT_ALLOWED');
  });
});

