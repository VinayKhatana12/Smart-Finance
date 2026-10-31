import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { startTestServer, type TestServer } from './helpers.js';
import { startTestDatabase, type TestDatabase } from './pg.js';

const app = createApp();
export let server: TestServer;
export let db: TestDatabase;

export async function startApi(): Promise<void> {
  db = await startTestDatabase();
  // Prisma reads DATABASE_URL through prisma.config.ts → process.env at CLI time.
  process.env.DATABASE_URL = db.url;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const serverRoot = path.resolve(here, '..');
  execSync('npx prisma migrate deploy', {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: db.url },
    stdio: 'pipe',
  });
  execSync('npx tsx prisma/seed.ts', {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: db.url },
    stdio: 'pipe',
  });
  server = await startTestServer(app);
}

export async function stopApi(): Promise<void> {
  await server?.close();
  await db?.stop();
}

/** A fresh signed-in agent with its own CSRF token. */
export async function signedInAgent(
  email: string,
  password = 'finance2026',
  name = 'Finance Tester',
): Promise<ReturnType<typeof request.agent>> {
  const a = request.agent(server.url);
  const csrf = (await a.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
  const res = await a
    .post('/api/v1/auth/register')
    .set('X-CSRF-Token', csrf)
    .send({ name, email, password, currency: 'INR', timezone: 'Asia/Kolkata' });
  if (res.status !== 201) throw new Error(`registration failed: ${JSON.stringify(res.body)}`);
  return a;
}

export const csrfOf = async (a: ReturnType<typeof request.agent>): Promise<string> =>
  (await a.get('/api/v1/auth/csrf')).body.data.csrfToken as string;

export const post = (a: ReturnType<typeof request.agent>, url: string, body: unknown, token: string) =>
  a.post(url).set('X-CSRF-Token', token).send(body);

export const patch = (a: ReturnType<typeof request.agent>, url: string, body: unknown, token: string) =>
  a.patch(url).set('X-CSRF-Token', token).send(body);

export const del = (a: ReturnType<typeof request.agent>, url: string, token: string) =>
  a.delete(url).set('X-CSRF-Token', token);
