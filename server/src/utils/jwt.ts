import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';
import { ACCESS_TTL_MS } from './cookies.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: Math.floor(ACCESS_TTL_MS / 1000) };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new Error('Malformed token payload');
    }
    return { sub: decoded.sub, email: typeof decoded.email === 'string' ? decoded.email : '' };
  } catch {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Refresh the session and try again.');
  }
}
