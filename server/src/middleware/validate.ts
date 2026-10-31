import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError.js';

type Source = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodTypeAny, source: Source = 'body'): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new ApiError(
          400,
          'VALIDATION_ERROR',
          'Some fields need attention.',
          result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      );
      return;
    }
    if (source === 'body') {
      req.body = result.data;
    }
    next();
  };
