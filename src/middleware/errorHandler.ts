import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function notFoundHandler(req: Request, res: Response) {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `A keresett API végpont (${req.method} ${req.path}) nem található.`,
      },
    });
    return;
  }

  // For frontend routes, respond with not found
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="hu">
    <head>
      <meta charset="UTF-8">
      <title>404 - Az oldal nem található | OnDemand</title>
      <meta name="robots" content="noindex">
      <style>
        body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
        .box { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        h1 { font-size: 48px; margin: 0; color: #2563eb; }
        p { margin: 16px 0 24px; color: #64748b; }
        a { display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>404</h1>
        <p>A keresett oldal nem található.</p>
        <a href="/">Vissza a főoldalra</a>
      </div>
    </body>
    </html>
  `);
}

export function globalErrorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'A kérés törzse érvénytelen JSON formátumú.',
      },
    });
    return;
  }

  // Handle payload too large
  if (err.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'A feltöltött adatmennyiség meghaladja a megengedett méretet.',
      },
    });
    return;
  }

  const isProduction = env.isProd();
  console.error('Unhandled Server Error:', {
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction
        ? 'Váratlan szerverhiba történt. Kérjük, próbálja újra később.'
        : err.message || 'Belső szerverhiba',
      stack: isProduction ? undefined : err.stack,
    },
  });
}

