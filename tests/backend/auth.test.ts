import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authService, type User } from '../../src/services/authService.js';
import { env } from '../../src/config/env.js';

describe('Auth Service & Token Verification', () => {
  it('finds bootstrapped admin user and verifies correct password', () => {
    const admin = authService.findByUsername(env.ADMIN_BOOTSTRAP_USER);
    assert.ok(admin, 'Admin user should exist in bootstrap store');
    assert.equal(admin.role, 'admin');

    const isValid = authService.verifyPassword(admin, env.ADMIN_BOOTSTRAP_PASS);
    assert.equal(isValid, true, 'Correct password must verify');

    const isInvalid = authService.verifyPassword(admin, 'WrongPassword123');
    assert.equal(isInvalid, false, 'Incorrect password must be rejected');
  });

  it('creates and validates signed JWT token', () => {
    const admin = authService.findByUsername(env.ADMIN_BOOTSTRAP_USER)!;
    const token = authService.createToken(admin);
    assert.ok(token, 'Token string must be created');

    const verification = authService.verifyToken(token);
    assert.equal(verification.valid, true);
    assert.equal(verification.payload?.username, admin.username);
    assert.equal(verification.payload?.role, 'admin');
  });

  it('detects and rejects tampered token signatures', () => {
    const admin = authService.findByUsername(env.ADMIN_BOOTSTRAP_USER)!;
    const token = authService.createToken(admin);
    const parts = token.split('.');

    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()), role: 'superadmin' })
    ).toString('base64url');

    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const result = authService.verifyToken(tamperedToken);

    assert.equal(result.valid, false);
    assert.equal(result.reason, 'INVALID_SIGNATURE');
  });

  it('detects malformed tokens', () => {
    const result1 = authService.verifyToken('invalid.token');
    assert.equal(result1.valid, false);
    assert.equal(result1.reason, 'TOKEN_MALFORMED');

    const result2 = authService.verifyToken('random-garbage-string');
    assert.equal(result2.valid, false);
  });

  it('handles operator role properly', () => {
    const operator = authService.findByUsername(env.OPERATOR_BOOTSTRAP_USER);
    assert.ok(operator);
    assert.equal(operator.role, 'operator');

    const token = authService.createToken(operator);
    const result = authService.verifyToken(token);
    assert.equal(result.valid, true);
    assert.equal(result.payload?.role, 'operator');
  });
});

