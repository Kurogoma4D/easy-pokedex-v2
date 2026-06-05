import { describe, expect, it } from 'vitest';

import { validateCredentials } from './validation.js';

describe('validateCredentials', () => {
  it('accepts valid credentials and normalizes the email', () => {
    const result = validateCredentials({
      email: '  Trainer@Example.COM ',
      password: 'password123',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('trainer@example.com');
    }
  });

  it('rejects non-string body', () => {
    expect(validateCredentials({ email: 1, password: 2 })).toMatchObject({ ok: false });
  });

  it('rejects malformed email', () => {
    expect(validateCredentials({ email: 'nope', password: 'password123' })).toMatchObject({
      ok: false,
      error: 'invalid_email',
    });
  });

  it('rejects short password', () => {
    expect(validateCredentials({ email: 'a@b.com', password: 'short' })).toMatchObject({
      ok: false,
      error: 'invalid_password',
    });
  });
});
