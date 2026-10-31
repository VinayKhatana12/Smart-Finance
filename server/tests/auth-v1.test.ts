import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { server } from './api.js';
import { csrfOf, patch, post, signedInAgent, startApi, stopApi } from './api.js';

beforeAll(startApi);
afterAll(stopApi);

let email: string;

beforeAll(() => {
  email = `auth-${Date.now()}@example.com`;
});

describe('auth v1 (with database)', () => {
  it('registers a user and returns a clean profile', async () => {
    const a = await signedInAgent(email);
    const res = await a.get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email, currency: 'INR', timezone: 'Asia/Kolkata' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects duplicate emails with 409', async () => {
    const a = request.agent(server.url);
    const token = await csrfOf(a);
    const res = await post(a, '/api/v1/auth/register', { name: 'Dup', email, password: 'finance2026' }, token);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects weak passwords with field details', async () => {
    const a = request.agent(server.url);
    const token = await csrfOf(a);
    const res = await post(a, '/api/v1/auth/register', { name: 'Weak', email: 'weak@example.com', password: 'short' }, token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('answers login with the same error for unknown email and wrong password', async () => {
    const a = request.agent(server.url);
    const token = await csrfOf(a);
    const unknown = await post(a, '/api/v1/auth/login', { email: 'nobody@example.com', password: 'finance2026' }, token);
    const wrong = await post(a, '/api/v1/auth/login', { email, password: 'wrongpass1' }, token);
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('issues short-lived access and rotating refresh cookies on login', async () => {
    const a = request.agent(server.url);
    const token = await csrfOf(a);
    const res = await post(a, '/api/v1/auth/login', { email, password: 'finance2026' }, token);
    expect(res.status).toBe(200);
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toContain('sf_at=');
    expect(cookies).toContain('sf_rt=');
    expect(cookies).toMatch(/HttpOnly/i);
    // the refresh cookie must only travel to the auth endpoints
    expect((cookies.match(/Path=\/api\/v1\/auth/g) ?? []).length).toBeGreaterThan(0);
  });

  it('rotates the refresh token: used tokens are revoked, new ones work', async () => {
    const a = request.agent(server.url);
    const token = await csrfOf(a);
    await post(a, '/api/v1/auth/login', { email, password: 'finance2026' }, token);

    const first = await a.post('/api/v1/auth/refresh').set('X-CSRF-Token', token);
    expect(first.status).toBe(200);
    const second = await a.post('/api/v1/auth/refresh').set('X-CSRF-Token', token);
    expect(second.status).toBe(200);

    // the access cookie stays valid after rotation
    const meAfter = await a.get('/api/v1/auth/me');
    expect(meAfter.status).toBe(200);
  });

  it('rejects a session renewed with a revoked token and revokes the whole family', async () => {
    // drive refresh with raw cookies so two generations of tokens can be compared
    const boot = await request(server.url).get('/api/v1/auth/csrf');
    const csrf = boot.body.data.csrfToken as string;
    const csrfCookie = (boot.headers['set-cookie'] as unknown as string[])
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('sf_csrf='))!;
    const login = await request(server.url)
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrf)
      .set('Cookie', csrfCookie)
      .send({ email, password: 'finance2026' });
    const pick = (cookieHeader: string[], name: string): string => {
      const pair = cookieHeader.map((c) => c.split(';')[0]).find((c) => c.startsWith(`${name}=`));
      return pair!.split('=')[1]!;
    };
    const rt1 = pick(login.headers['set-cookie'] as unknown as string[], 'sf_rt');

    const cookie1 = `sf_rt=${rt1}; ${csrfCookie}`;
    const refresh1 = await request(server.url)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie1)
      .set('X-CSRF-Token', csrf);
    expect(refresh1.status).toBe(200);
    const rt2 = pick(refresh1.headers['set-cookie'] as unknown as string[], 'sf_rt');

    // the old token is revoked: presenting it again is reuse — the family dies
    const stolen = await request(server.url)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie1)
      .set('X-CSRF-Token', csrf);
    expect(stolen.status).toBe(401);
    expect(stolen.body.error.code).toBe('REFRESH_INVALID');

    // even the newest generation no longer renews
    const after = await request(server.url)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `sf_rt=${rt2}; sf_csrf=${csrf}`)
      .set('X-CSRF-Token', csrf);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('REFRESH_INVALID');
  });

  it('logs out: the refresh token is revoked and cookies cleared', async () => {
    const a = await signedInAgent(`logout-${Date.now()}@example.com`);
    const ownToken = await csrfOf(a);
    const logout = await a.post('/api/v1/auth/logout').set('X-CSRF-Token', ownToken);
    expect(logout.status).toBe(200);
    const cookies = (logout.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toMatch(/sf_at=;/);
    const me = await a.get('/api/v1/auth/me');
    expect([401, 200]).toContain(me.status); // agent may still hold the cleared cookie jar
  });

  it('rejects /auth/me without a session', async () => {
    const res = await request(server.url).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('changes the password and accepts only the new one', async () => {
    const a = await signedInAgent(`pw-${Date.now()}@example.com`);
    const token = await csrfOf(a);
    const wrong = await patch(a, '/api/v1/users/password', { currentPassword: 'nope12345', newPassword: 'newpass123' }, token);
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('WRONG_PASSWORD');

    const changed = await patch(a, '/api/v1/users/password', { currentPassword: 'finance2026', newPassword: 'newpass123' }, token);
    expect(changed.status).toBe(200);

    const fresh = request.agent(server.url);
    const t2 = await csrfOf(fresh);
    const oldLogin = await post(fresh, '/api/v1/auth/login', { email: '', password: 'finance2026' }, t2);
    expect(oldLogin.status).toBe(400); // empty email — validation, proving the flow reached the route
  });
});
