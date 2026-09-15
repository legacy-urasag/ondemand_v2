import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export function formatZodIssues(issues: z.ZodIssue[]) {
  return issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
  }));
}

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req.body);
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A beküldött adatok érvénytelenek. Kérjük, javítsa a hibákat.',
            details: formatZodIssues(err.issues),
          },
        });
        return;
      }
      next(err);
    }
  };
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req.params);
      req.params = parsed as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Érvénytelen útvonal paraméterek.',
            details: formatZodIssues(err.issues),
          },
        });
        return;
      }
      next(err);
    }
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req.query);
      req.query = parsed as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Érvénytelen keresési paraméterek.',
            details: formatZodIssues(err.issues),
          },
        });
        return;
      }
      next(err);
    }
  };
}

