import { timingSafeEqual, randomBytes } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { CSRF_COOKIE, csrfCookieOptions } from '../utils/cookies.js';
import { ApiError } from '../utils/ApiError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function valuesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Mints the double-submit CSRF cookie on safe requests when absent. */
export const ensureCsrfCookie: RequestHandler = (req, res, next) => {
  // The /csrf endpoint mints its own cookie so exactly one Set-Cookie is ever
  // emitted for a given response.
  if (SAFE_METHODS.has(req.method) && !req.cookies?.[CSRF_COOKIE] && !req.path.endsWith('/auth/csrf')) {
    res.cookie(CSRF_COOKIE, randomBytes(32).toString('hex'), csrfCookieOptions());
  }
  next();
};

/** Mutating requests must echo the CSRF cookie value in the X-CSRF-Token header. */
export const verifyCsrf: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const header = req.header('x-csrf-token');
  if (!cookie || !header || !valuesMatch(cookie, header)) {
    next(new ApiError(403, 'CSRF_INVALID', 'Your request is missing a valid security token. Refresh the page and try again.'));
    return;
  }
  next();
};
