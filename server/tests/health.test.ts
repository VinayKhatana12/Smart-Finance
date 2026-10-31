import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { startApi, stopApi, server } from './api.js';

beforeAll(startApi);
afterAll(stopApi);

describe('GET /api/v1/health', () => {
  it('returns the standard success envelope with a live database', async () => {
    const res = await request(server.url).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.db).toBe('connected');
  });
});

describe('unknown routes', () => {
  it('return the standard 404 envelope', async () => {
    const res = await request(server.url).get('/api/v1/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('CSRF protection', () => {
  it('rejects a mutating request with no CSRF token', async () => {
    const res = await request(server.url).post('/api/v1/auth/login').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('mints a readable csrf cookie on GET /api/v1/auth/csrf', async () => {
    const res = await request(server.url).get('/api/v1/auth/csrf');
    expect(res.status).toBe(200);
    const token: string = res.body.data.csrfToken;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain(`sf_csrf=${token}`);
    // readable by the browser script on purpose (double-submit)
    expect(cookies.join(';')).not.toMatch(/HttpOnly/i);
  });

  it('rejects a mutation whose header does not match the cookie', async () => {
    const agent = request.agent(server.url);
    await agent.get('/api/v1/auth/csrf');
    const res = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', 'a'.repeat(64))
      .send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });
});
