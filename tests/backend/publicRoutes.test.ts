import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createServer } from '../../src/server.js';
import { submissionService } from '../../src/services/submissionService.js';

describe('Public API Routes Integration', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = createServer();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    submissionService.clearAll();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/health returns 200 and healthy status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp);
  });

  it('GET /api/services returns list of valid trades', async () => {
    const res = await fetch(`${baseUrl}/api/services`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 5);
    assert.ok(body.data.some((s: any) => s.title === 'Villanyszerelő'));
  });

  it('POST /api/forms/customer creates inquiry with valid payload', async () => {
    const payload = {
      name: 'Nagy Balázs',
      email: 'nagy.balazs@example.com',
      phone: '+36 30 555 1234',
      location: 'Budapest, III. kerület',
      jobTypes: ['Villanyszerelő'],
      urgency: 'urgent',
      description: 'Biztosítéktábla csere szükséges.',
    };

    const res = await fetch(`${baseUrl}/api/forms/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data?.trackingId);
    assert.equal(body.data.status, 'pending');
  });

  it('POST /api/forms/customer returns 400 Bad Request on invalid email', async () => {
    const payload = {
      name: 'Teszt Elek',
      email: 'invalid-email-address',
      phone: '+36 30 111 2222',
      location: 'Budapest',
      jobTypes: ['Vízvezetékszerelő'],
      urgency: 'normal',
    };

    const res = await fetch(`${baseUrl}/api/forms/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'VALIDATION_ERROR');
    assert.ok(body.error?.details?.some((d: any) => d.field === 'email'));
  });

  it('POST /api/forms/freelancer creates application with valid payload', async () => {
    const payload = {
      name: 'Kovács Ferenc Mester',
      email: 'kovacs.mester@example.hu',
      phone: '+36 70 333 4444',
      trades: ['Vízvezetékszerelő', 'Fűtésszerelő (vagy gépész)'],
      experience: '10+',
      areas: 'I., II., XII. kerület',
    };

    const res = await fetch(`${baseUrl}/api/forms/freelancer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data?.applicationId);
    assert.equal(body.data.status, 'pending');
  });

  it('POST /api/forms/freelancer rejects invalid trade', async () => {
    const payload = {
      name: 'Nem Létező Szakma',
      email: 'valid@example.hu',
      phone: '+36 70 333 4444',
      trades: ['NemLétezőSzakma123'],
      experience: '3-5',
    };

    const res = await fetch(`${baseUrl}/api/forms/freelancer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error?.code, 'VALIDATION_ERROR');
  });
});

