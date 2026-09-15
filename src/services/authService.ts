import crypto from 'node:crypto';
import { env } from '../config/env.js';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface TokenPayload {
  sub: string;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// In-memory user store initialized with secure hashed credentials
class UserService {
  private users = new Map<string, User>();

  constructor() {
    this.bootstrapUsers();
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  }

  private bootstrapUsers() {
    // Admin user
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminUser: User = {
      id: 'usr_admin_01',
      username: env.ADMIN_BOOTSTRAP_USER,
      role: 'admin',
      salt: adminSalt,
      passwordHash: this.hashPassword(env.ADMIN_BOOTSTRAP_PASS, adminSalt),
      createdAt: new Date().toISOString(),
    };
    this.users.set(adminUser.username.toLowerCase(), adminUser);

    // Operator user
    const operatorSalt = crypto.randomBytes(16).toString('hex');
    const operatorUser: User = {
      id: 'usr_operator_01',
      username: env.OPERATOR_BOOTSTRAP_USER,
      role: 'operator',
      salt: operatorSalt,
      passwordHash: this.hashPassword(env.OPERATOR_BOOTSTRAP_PASS, operatorSalt),
      createdAt: new Date().toISOString(),
    };
    this.users.set(operatorUser.username.toLowerCase(), operatorUser);
  }

  findByUsername(username: string): User | undefined {
    return this.users.get(username.toLowerCase());
  }

  findById(id: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.id === id) return user;
    }
    return undefined;
  }

  verifyPassword(user: User, attempt: string): boolean {
    const attemptHash = this.hashPassword(attempt, user.salt);
    const bufA = Buffer.from(attemptHash, 'hex');
    const bufB = Buffer.from(user.passwordHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  createToken(user: User): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      iat: now,
      exp: now + env.JWT_EXPIRES_IN,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(`${b64Header}.${b64Payload}`)
      .digest('base64url');

    return `${b64Header}.${b64Payload}.${signature}`;
  }

  verifyToken(token: string): { valid: boolean; payload?: TokenPayload; reason?: string } {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, reason: 'TOKEN_MALFORMED' };
      }

      const [b64Header, b64Payload, signature] = parts;
      const expectedSig = crypto
        .createHmac('sha256', env.JWT_SECRET)
        .update(`${b64Header}.${b64Payload}`)
        .digest('base64url');

      const bufA = Buffer.from(signature);
      const bufB = Buffer.from(expectedSig);
      if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
        return { valid: false, reason: 'INVALID_SIGNATURE' };
      }

      const payload: TokenPayload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        return { valid: false, reason: 'TOKEN_EXPIRED' };
      }

      return { valid: true, payload };
    } catch {
      return { valid: false, reason: 'TOKEN_INVALID' };
    }
  }
}

export const authService = new UserService();

