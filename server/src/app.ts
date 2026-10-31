import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { corsOrigins } from './config/env.js';
import { ensureCsrfCookie, verifyCsrf } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { v1Router } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // The API serves JSON only; the SPA ships its own security headers from Vite/hosting.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  // Double-submit CSRF: mint the readable cookie on safe requests,
  // require header + cookie match on every mutation.
  app.use(ensureCsrfCookie);
  app.use(verifyCsrf);

  app.use('/api/v1', v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
