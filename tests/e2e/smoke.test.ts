import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createServer } from '../../src/server.js';
import { submissionService } from '../../src/services/submissionService.js';
import { env } from '../../src/config/env.js';

describe('End-to-End Smoke Tests: Core User Flows & Platform Security', () => {
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

  it('[E2E 1] Application loads successfully with complete SEO metadata', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200, 'Homepage must load with HTTP 200');
    const html = await res.text();

    // Verify Title & Meta description
    assert.ok(html.includes('<title>OnDemand – Ellenőrzött Szakemberek Budapesten'), 'Title must be present and optimized');
    assert.ok(html.includes('<meta name="description" content="OnDemand: Ellenőrzött'), 'Meta description must be present');

    // Verify Canonical & OpenGraph
    assert.ok(html.includes('<link rel="canonical" href="https://ondemand.hu/">'), 'Canonical URL must point to production canonical');
    assert.ok(html.includes('<meta property="og:title"'), 'OpenGraph title must be present');
    assert.ok(html.includes('<meta property="og:url" content="https://ondemand.hu/">'), 'OpenGraph URL must be present');

    // Verify Structured Data JSON-LD
    assert.ok(html.includes('application/ld+json'), 'JSON-LD structured data script must be embedded');
    assert.ok(html.includes('HomeAndConstructionBusiness'), 'Local business schema must be defined');
    assert.ok(html.includes('BreadcrumbList'), 'BreadcrumbList schema must be defined');
  });

  it('[E2E 2] SEO crawlability: robots.txt and sitemap.xml are served correctly', async () => {
    // Check robots.txt
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robotsRes.status, 200);
    assert.ok(robotsRes.headers.get('content-type')?.includes('text/plain'));
    const robotsText = await robotsRes.text();
    assert.ok(robotsText.includes('User-agent: *'));
    assert.ok(robotsText.includes('Disallow: /api/'));
    assert.ok(robotsText.includes('Sitemap:'));

    // Check sitemap.xml
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapRes.status, 200);
    assert.ok(sitemapRes.headers.get('content-type')?.includes('xml'));
    const sitemapXml = await sitemapRes.text();
    assert.ok(sitemapXml.includes('<urlset'));
    assert.ok(sitemapXml.includes('<loc>'));
    assert.ok(sitemapXml.includes('/szolgaltatasok/villanyszerelo'));
  });

  it('[E2E 3] Core User Flow: Customer submits service inquiry', async () => {
    // 1. Valid customer inquiry
    const validInquiry = {
      name: 'Varga Katalin',
      email: 'varga.katalin@example.hu',
      phone: '+36 30 777 8899',
      location: 'Budapest, XII. kerület, Alkotás u.',
      jobTypes: ['Vízvezetékszerelő'],
      urgency: 'emergency',
      description: 'Csőtörés a fürdőszobában, elzártam a főcsapot.',
    };

    const submitRes = await fetch(`${baseUrl}/api/forms/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validInquiry),
    });

    assert.equal(submitRes.status, 201, 'Valid submission must return 201 Created');
    const submitData = await submitRes.json();
    assert.equal(submitData.success, true);
    assert.ok(submitData.data?.trackingId, 'Must return tracking ID for user reference');
    assert.equal(submitData.data?.status, 'pending');

    // 2. Invalid customer inquiry (missing required fields, malformed phone)
    const invalidInquiry = {
      name: 'V', // too short
      email: 'not-an-email',
      phone: 'invalid',
      location: '',
      jobTypes: [],
      urgency: 'yesterday',
    };

    const invalidRes = await fetch(`${baseUrl}/api/forms/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidInquiry),
    });

    assert.equal(invalidRes.status, 400, 'Invalid submission must be rejected with 400');
    const invalidData = await invalidRes.json();
    assert.equal(invalidData.success, false);
    assert.equal(invalidData.error?.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(invalidData.error?.details));
    assert.ok(invalidData.error?.details.length >= 4, 'Must detail all failing validation fields');
  });

  it('[E2E 4] Core User Flow: Freelancer applies with license document', async () => {
    const validApplication = {
      name: 'Horváth Gábor',
      email: 'horvath.gabor@szaki.hu',
      phone: '+36 20 444 5566',
      trades: ['Villanyszerelő', 'Asztalos'],
      experience: '6-10',
      areas: 'II., III., XI. kerület',
      licenseFileName: 'villanyszerelo_mesterlevel.pdf',
      licenseFileType: 'application/pdf',
      licenseFileBase64: 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDw...',
    };

    const res = await fetch(`${baseUrl}/api/forms/freelancer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validApplication),
    });

    assert.equal(res.status, 201, 'Freelancer submission must return 201 Created');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.data?.applicationId);
    assert.equal(data.data?.status, 'pending');
  });

  it('[E2E 5] Admin & Security Flow: Authenticate, inspect leads, and approve application', async () => {
    // 1. Unauthorized attempt to inspect leads
    const unauthRes = await fetch(`${baseUrl}/api/admin/customers`);
    assert.equal(unauthRes.status, 401, 'Unauthenticated access must be rejected with 401');

    // 2. Admin logs in
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: env.ADMIN_BOOTSTRAP_USER,
        password: env.ADMIN_BOOTSTRAP_PASS,
      }),
    });
    assert.equal(loginRes.status, 200, 'Login must succeed with correct credentials');
    const loginData = await loginRes.json();
    assert.ok(loginData.data?.token, 'Login must return a signed token');
    const token = loginData.data.token;

    // 3. Verify user profile (/api/auth/me)
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.data?.username, env.ADMIN_BOOTSTRAP_USER);
    assert.equal(meData.data?.role, 'admin');

    // 4. View submitted customer inquiries
    const customersRes = await fetch(`${baseUrl}/api/admin/customers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(customersRes.status, 200);
    const customersData = await customersRes.json();
    assert.ok(customersData.data.some((c: any) => c.name === 'Varga Katalin'));

    // 5. View submitted freelancer applications
    const freelancersRes = await fetch(`${baseUrl}/api/admin/freelancers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(freelancersRes.status, 200);
    const freelancersData = await freelancersRes.json();
    const gaborApp = freelancersData.data.find((f: any) => f.name === 'Horváth Gábor');
    assert.ok(gaborApp, 'Application submitted in E2E 4 must be listed in admin');

    // 6. Inspect freelancer license
    const licenseRes = await fetch(`${baseUrl}/api/admin/freelancers/${gaborApp.id}/license`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(licenseRes.status, 200);
    const licenseData = await licenseRes.json();
    assert.equal(licenseData.data?.fileName, 'villanyszerelo_mesterlevel.pdf');

    // 7. Approve freelancer
    const approveRes = await fetch(`${baseUrl}/api/admin/freelancers/${gaborApp.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'approved',
        note: 'Dokumentumok rendben.',
      }),
    });
    assert.equal(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.equal(approveData.data?.status, 'approved');
  });

  it('[E2E 6] Security smoke: CORS preflight and rate limit headers verified', async () => {
    // 1. CORS Preflight with whitelisted origin
    const preflightRes = await fetch(`${baseUrl}/api/forms/customer`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    assert.equal(preflightRes.status, 204);
    assert.equal(preflightRes.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.equal(preflightRes.headers.get('access-control-allow-credentials'), 'true');

    // 2. CORS Preflight with unauthorized origin
    const badCorsRes = await fetch(`${baseUrl}/api/forms/customer`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://untrusted-third-party.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(badCorsRes.status, 403);

    // 3. Rate limit headers on normal request
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.ok(healthRes.headers.get('ratelimit-limit'), 'RateLimit-Limit header must be present');
    assert.ok(healthRes.headers.get('ratelimit-remaining'), 'RateLimit-Remaining header must be present');
  });
});

