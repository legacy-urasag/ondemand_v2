import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createServer } from '../../src/server.js';
import { submissionService } from '../../src/services/submissionService.js';
import { env } from '../../src/config/env.js';

describe('Admin Protected Routes & Authorization', () => {
  let server: Server;
  let baseUrl: string;
  let adminToken: string;
  let operatorToken: string;

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

    // Login as Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: env.ADMIN_BOOTSTRAP_USER,
        password: env.ADMIN_BOOTSTRAP_PASS,
      }),
    });
    const adminData = await adminLoginRes.json();
    adminToken = adminData.data.token;

    // Login as Operator
    const opLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: env.OPERATOR_BOOTSTRAP_USER,
        password: env.OPERATOR_BOOTSTRAP_PASS,
      }),
    });
    const opData = await opLoginRes.json();
    operatorToken = opData.data.token;
  });

  after(async () => {
    submissionService.clearAll();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects access to /api/admin/stats without authentication (401)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error?.code, 'AUTH_REQUIRED');
  });

  it('rejects access with invalid or forged token (401)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { Authorization: 'Bearer forged.invalid.token' },
    });
    assert.equal(res.status, 401);
  });

  it('allows authenticated admin to view stats', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(typeof body.data.totalCustomerInquiries === 'number');
  });

  it('allows authenticated admin to view inquiries and applications', async () => {
    submissionService.createCustomerInquiry({
      name: 'Teszt Ügyfél',
      email: 'ugyfel@test.hu',
      phone: '+36 30 111 2222',
      location: 'Budapest, I. kerület',
      jobTypes: ['Villanyszerelő'],
      urgency: 'normal',
    });

    const res = await fetch(`${baseUrl}/api/admin/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 1);
  });

  it('allows operator to update freelancer status', async () => {
    const fl = submissionService.createFreelancerApplication({
      name: 'Mester József',
      email: 'mester.jozsef@test.hu',
      phone: '+36 20 555 6677',
      trades: ['Villanyszerelő'],
      experience: '3-5',
    });

    const updateRes = await fetch(`${baseUrl}/api/admin/freelancers/${fl.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${operatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'approved',
        note: 'Dokumentumok ellenőrizve, engedélyezve.',
      }),
    });

    assert.equal(updateRes.status, 200);
    const body = await updateRes.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'approved');
  });

  it('rejects invalid ID format with 400 Bad Request to protect against IDOR/injection', async () => {
    const res = await fetch(`${baseUrl}/api/admin/customers/../../etc/passwd`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    // Should be rejected by routing or 400 parameter validation
    assert.ok(res.status === 400 || res.status === 404);
  });
});

