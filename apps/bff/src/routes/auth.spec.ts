import { describe, expect, it } from 'vitest';

import { createTestApp } from '../test-app.js';

/** Set-Cookie からセッション Cookie 値を取り出す。 */
function sessionCookie(res: Response): string | undefined {
  const header = res.headers.get('set-cookie');
  if (header === null) {
    return undefined;
  }
  const match = /pdx_session=([^;]*)/.exec(header);
  return match?.[1];
}

const credentials = { email: 'trainer@example.com', password: 'password123' };

describe('auth routes', () => {
  it('registers a user and issues an HttpOnly session cookie', async () => {
    const { app } = createTestApp();
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('pdx_session=');
    expect(setCookie?.toLowerCase()).toContain('httponly');
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe(credentials.email);
  });

  it('does not store the password in plaintext', async () => {
    const { app, repo } = createTestApp();
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const user = await repo.findUserByEmail(credentials.email);
    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe(credentials.password);
    expect(user?.passwordHash.startsWith('$2')).toBe(true);
  });

  it('rejects duplicate email registration with 409', async () => {
    const { app } = createTestApp();
    const register = (): Promise<Response> =>
      app.request('/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credentials),
      });
    await register();
    const res = await register();
    expect(res.status).toBe(409);
  });

  it('rejects invalid email and short password', async () => {
    const { app } = createTestApp();
    const badEmail = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'password123' }),
    });
    expect(badEmail.status).toBe(400);

    const shortPassword = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'short' }),
    });
    expect(shortPassword.status).toBe(400);
  });

  it('logs in a registered user and rejects wrong credentials', async () => {
    const { app } = createTestApp();
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const ok = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    expect(ok.status).toBe(200);
    expect(sessionCookie(ok)).toBeTruthy();

    const wrong = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...credentials, password: 'wrongpassword' }),
    });
    expect(wrong.status).toBe(401);
  });

  it('invalidates the session on logout', async () => {
    const { app } = createTestApp();
    const register = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const cookie = `pdx_session=${sessionCookie(register)}`;

    const before = await app.request('/auth/me', { headers: { cookie } });
    expect(before.status).toBe(200);

    const logout = await app.request('/auth/logout', { method: 'POST', headers: { cookie } });
    expect(logout.status).toBe(204);

    const after = await app.request('/auth/me', { headers: { cookie } });
    expect(after.status).toBe(401);
  });

  it('rejects /me without a session', async () => {
    const { app } = createTestApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(401);
  });
});
