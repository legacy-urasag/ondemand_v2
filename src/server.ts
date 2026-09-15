import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { corsMiddleware } from './middleware/cors.js';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js';
import { publicRouter } from './routes/public.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { seoRouter } from './routes/seo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

export function createServer() {
  const app = express();

  // Basic security headers (Zero external dependency)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CORS middleware (Explicit origins, credentials, preflight)
  app.use(corsMiddleware);

  // Body parsers with safe payload limits
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // SEO routes (robots.txt, sitemap.xml, dynamic metadata)
  app.use(seoRouter);

  // Serve public static assets (HTML, CSS, JS, images)
  app.use(express.static(publicDir, { index: 'index.html', maxAge: '1h' }));

  // Dynamic service page handler (serves index.html with appropriate SEO status)
  app.get('/szolgaltatasok/:slug', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // Admin Portal UI
  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
  });

  // Mount API routers
  app.use('/api', publicRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  // 404 & Global Error Handling
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
