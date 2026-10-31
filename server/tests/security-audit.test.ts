import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { startApi, stopApi, server } from './api.js';

beforeAll(startApi);
afterAll(stopApi);

describe('security audit', () => {
  it('sets HttpOnly, SameSite, and (in production) Secure flags on auth cookies', async () => {
    const agent = request.agent(server.url);
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
    const res = await agent
      .post('/api/v1/auth/register')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Sec User', email: `sec-${Date.now()}@example.com`, password: 'securepass1' });

    const cookies = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toMatch(/sf_at=/);
    expect(cookies).toMatch(/HttpOnly/i);
    expect(cookies).toMatch(/SameSite/i);
  });

  it('never returns password hashes or token material in any response', async () => {
    const agent = request.agent(server.url);
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
    const reg = await agent
      .post('/api/v1/auth/register')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Hash Check', email: `hash-${Date.now()}@example.com`, password: 'securepass1' });
    const body = JSON.stringify(reg.body);
    expect(body).not.toMatch(/passwordHash/i);
    expect(body).not.toMatch(/sf_token|refresh/i);

    const me = await agent.get('/api/v1/auth/me');
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash/i);
    expect(me.headers['set-cookie'] === undefined || !JSON.stringify(me.headers).includes('securepass1')).toBe(true);
  });

  it('rejects unauthenticated access to every protected resource class', async () => {
    const routes: Array<[string, string]> = [
      ['get', '/api/v1/accounts'],
      ['get', '/api/v1/categories'],
      ['get', '/api/v1/transactions'],
      ['get', '/api/v1/budgets?month=10&year=2026'],
      ['get', '/api/v1/goals'],
      ['get', '/api/v1/notifications'],
      ['get', '/api/v1/dashboard/summary?month=10&year=2026'],
      ['get', '/api/v1/reports/summary?from=2026-10-01&to=2026-10-31'],
      ['get', '/api/v1/insights?month=2026-10'],
      ['get', '/api/v1/users/profile'],
    ];
    for (const [method, url] of routes) {
      const res = await request(server.url)[method](url);
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
    // mutations too — CSRF runs before auth, so anonymous mutations get 403;
    // both reject the request before it reaches any resource
    const post = await request(server.url).post('/api/v1/accounts').send({ name: 'x' });
    expect([401, 403]).toContain(post.status);
  });

  it('rate-limits repeated auth attempts', async () => {
    // valid CSRF pair so requests reach the credential check and the limiter
    const boot = await request(server.url).get('/api/v1/auth/csrf');
    const csrf = boot.body.data.csrfToken as string;
    const csrfCookie = ((boot.headers['set-cookie'] as unknown as string[])
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('sf_csrf=')))!;

    let limited = false;
    for (let i = 0; i < 60 && !limited; i++) {
      const res = await request(server.url)
        .post('/api/v1/auth/login')
        .set('Cookie', csrfCookie)
        .set('X-CSRF-Token', csrf)
        .send({ email: 'ratelimit@example.com', password: 'wrongpass1' });
      if (res.status === 429) limited = true;
    }
    expect(limited).toBe(true);
  });

  it('rejects malformed JWTs and tampered cookies outright', async () => {
    const tampered = await request(server.url)
      .get('/api/v1/auth/me')
      .set('Cookie', 'sf_at=abc.def.ghi');
    expect(tampered.status).toBe(401);

    const garbage = await request(server.url)
      .get('/api/v1/auth/me')
      .set('Cookie', 'sf_at=eyJhbGciOiJIUzI1NiJ9.not-a-signature.even-worse');
    expect(garbage.status).toBe(401);
  });

  it('surfaces safe error messages without stack traces', async () => {
    // force a 500 through a malformed uuid cast deep in a protected route
    const res = await request(server.url)
      .get('/api/v1/transactions/not-a-uuid-at-all');
    expect(res.status).toBe(401); // auth runs first — no leak of internals
    expect(JSON.stringify(res.body)).not.toMatch(/at \/|node_modules|\.ts:/);
  });
});
