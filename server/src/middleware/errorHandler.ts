import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { ZodError } from 'zod';
import { isProd } from '../config/env.js';
import { ApiError, type FieldError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: FieldError[] };
}

function sendError(res: Response, statusCode: number, code: string, message: string, details?: FieldError[]): void {
  const body: ErrorBody = { success: false, error: { code, message } };
  if (details && details.length > 0) body.error.details = details;
  res.status(statusCode).json(body);
}

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'ROUTE_NOT_FOUND', `No route matches ${req.method} ${req.path}.`);
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    sendError(res, error.statusCode, error.code, error.message, error.details);
    return;
  }

  if (error instanceof ZodError) {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Some fields need attention.',
      error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        sendError(res, 409, 'CONFLICT', 'That value already exists.');
        return;
      case 'P2025':
        sendError(res, 404, 'NOT_FOUND', 'That record does not exist.');
        return;
      case 'P2003':
        sendError(res, 400, 'INVALID_REFERENCE', 'That record is still referenced elsewhere.');
        return;
      default:
        break;
    }
  }

  logger.error(`Unhandled error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  sendError(
    res,
    500,
    'INTERNAL',
    isProd ? 'Something went wrong on our side. Please try again.' : `Internal error: ${error instanceof Error ? error.message : String(error)}`,
  );
};
