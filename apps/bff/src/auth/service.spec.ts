import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryAuthRepository } from './memory-repository.js';
import { AuthService } from './service.js';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(createMemoryAuthRepository());
  });

  it('登録に成功するとユーザーとセッションを発行する', async () => {
    const result = await service.register({ email: 'a@example.com', password: 'password123' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.email).toBe('a@example.com');
      expect(result.session.sessionId).toBeTruthy();
      expect(result.session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('不正入力の登録はバリデーションエラーを返す', async () => {
    const result = await service.register({ email: 'bad', password: 'short' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('validation');
    }
  });

  it('重複メールの登録は duplicate を返す', async () => {
    await service.register({ email: 'dup@example.com', password: 'password123' });
    const again = await service.register({ email: 'DUP@example.com', password: 'password123' });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.kind).toBe('duplicate');
    }
  });

  it('登録済みユーザーはログインできる', async () => {
    await service.register({ email: 'login@example.com', password: 'password123' });
    const result = await service.login({ email: 'login@example.com', password: 'password123' });
    expect(result.ok).toBe(true);
  });

  it('誤ったパスワードのログインは invalid_credentials を返す', async () => {
    await service.register({ email: 'login@example.com', password: 'password123' });
    const result = await service.login({ email: 'login@example.com', password: 'wrong-password' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('invalid_credentials');
    }
  });

  it('未登録メールのログインは invalid_credentials を返す', async () => {
    const result = await service.login({ email: 'none@example.com', password: 'password123' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('invalid_credentials');
    }
  });

  it('セッション id から現在のユーザーを解決できる', async () => {
    const reg = await service.register({ email: 'me@example.com', password: 'password123' });
    if (!reg.ok) {
      throw new Error('registration should succeed');
    }
    const user = await service.resolveUser(reg.session.sessionId);
    expect(user?.email).toBe('me@example.com');
  });

  it('期限切れセッションは解決しない', async () => {
    const reg = await service.register({ email: 'exp@example.com', password: 'password123' });
    if (!reg.ok) {
      throw new Error('registration should succeed');
    }
    const future = new Date(reg.session.expiresAt.getTime() + 1000);
    const user = await service.resolveUser(reg.session.sessionId, future);
    expect(user).toBeNull();
  });

  it('ログアウト後はセッションが解決しない', async () => {
    const reg = await service.register({ email: 'out@example.com', password: 'password123' });
    if (!reg.ok) {
      throw new Error('registration should succeed');
    }
    await service.logout(reg.session.sessionId);
    const user = await service.resolveUser(reg.session.sessionId);
    expect(user).toBeNull();
  });
});
