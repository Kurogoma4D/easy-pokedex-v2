import { describe, expect, it } from 'vitest';

import { PASSWORD_MIN_LENGTH, validateCredentials } from './validation.js';

describe('validateCredentials', () => {
  it('正常な入力を受理しメールを正規化する', () => {
    const result = validateCredentials({ email: '  User@Example.COM ', password: 'password123' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('user@example.com');
      expect(result.value.password).toBe('password123');
    }
  });

  it('メール未指定を拒否する', () => {
    const result = validateCredentials({ email: undefined, password: 'password123' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'email')).toBe(true);
    }
  });

  it('不正なメール形式を拒否する', () => {
    for (const email of ['plainaddress', 'no-at.example.com', 'a@b', 'a b@c.com']) {
      const result = validateCredentials({ email, password: 'password123' });
      expect(result.ok, email).toBe(false);
    }
  });

  it('最小長未満のパスワードを拒否する', () => {
    const result = validateCredentials({
      email: 'user@example.com',
      password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('最大長超過のパスワードを拒否する', () => {
    const result = validateCredentials({
      email: 'user@example.com',
      password: 'a'.repeat(200),
    });
    expect(result.ok).toBe(false);
  });

  it('複数フィールドのエラーをまとめて返す', () => {
    const result = validateCredentials({ email: 'bad', password: 'short' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
    }
  });
});
