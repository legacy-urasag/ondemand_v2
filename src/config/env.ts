import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: ['.env.local', '.env'] });

const EnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  JWT_SECRET: z.string().min(16).default('ondemand_secure_jwt_key_at_least_32_chars_long_2026_dev'),
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
  RATE_LIMIT_STORAGE: z.enum(['memory', 'redis']).default('memory'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 mins
  RATE_LIMIT_MAX_PUBLIC: z.coerce.number().default(100),
  RATE_LIMIT_MAX_FORMS: z.coerce.number().default(15),
  RATE_LIMIT_MAX_AUTH: z.coerce.number().default(5),
  ADMIN_BOOTSTRAP_USER: z.string().default('admin'),
  ADMIN_BOOTSTRAP_PASS: z.string().default('AdminSecure2026!'),
  OPERATOR_BOOTSTRAP_USER: z.string().default('operator'),
  OPERATOR_BOOTSTRAP_PASS: z.string().default('OperatorSecure2026!'),
});

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables configuration:', parsedEnv.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = {
  ...parsedEnv.data,
  getAllowedOrigins(): string[] {
    return parsedEnv.data.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  },
  isProd(): boolean {
    return parsedEnv.data.NODE_ENV === 'production';
  },
  isTest(): boolean {
    return parsedEnv.data.NODE_ENV === 'test';
  },
};

