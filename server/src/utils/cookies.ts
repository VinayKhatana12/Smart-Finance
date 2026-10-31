import type { CookieOptions } from 'express';
import { env, isProd } from '../config/env.js';

export const ACCESS_COOKIE = 'sf_at';
export const REFRESH_COOKIE = 'sf_rt';
export const CSRF_COOKIE = 'sf_csrf';

export const ACCESS_TTL_MS = 15 * 60 * 1000; // short-lived access token
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // rotating refresh token

// The packaged Android app talks to the API from the WebView origin, which is
// a different site — cookies need SameSite=None (HTTPS-only in production)
// there, while the web app keeps the stricter Lax. Configurable via env.
const sameSite: CookieOptions['sameSite'] =
  env.COOKIE_SAMESITE === 'none' ? 'none' : 'lax';

export function accessCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite, path: '/', maxAge: ACCESS_TTL_MS };
}

/** The refresh cookie only ever travels to the auth endpoints. */
export function refreshCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite, path: '/api/v1/auth', maxAge: REFRESH_TTL_MS };
}

export function accessCookieClearOptions(): CookieOptions {
  const { maxAge: _maxAge, ...rest } = accessCookieOptions();
  return rest;
}

export function refreshCookieClearOptions(): CookieOptions {
  const { maxAge: _maxAge, ...rest } = refreshCookieOptions();
  return rest;
}

export function csrfCookieOptions(): CookieOptions {
  return { httpOnly: false, secure: isProd, sameSite, path: '/', maxAge: REFRESH_TTL_MS };
}
