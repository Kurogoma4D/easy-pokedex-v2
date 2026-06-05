import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('ハッシュは平文を含まず自己記述的な形式を持つ', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash.split('$')).toHaveLength(6);
  });

  it('同じパスワードでもソルトにより毎回異なるハッシュになる', async () => {
    const a = await hashPassword('password123');
    const b = await hashPassword('password123');
    expect(a).not.toBe(b);
  });

  it('正しいパスワードを検証できる', async () => {
    const hash = await hashPassword('password123');
    expect(await verifyPassword('password123', hash)).toBe(true);
  });

  it('誤ったパスワードを拒否する', async () => {
    const hash = await hashPassword('password123');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('壊れたハッシュ文字列では false を返す', async () => {
    expect(await verifyPassword('password123', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('password123', 'scrypt$x$y$z$a$b')).toBe(false);
  });
});
