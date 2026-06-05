import { describe, expect, it } from 'vitest';

import { loadDbEnv } from './env.js';

const baseSecret = { SESSION_SECRET: 'super-secret-value' } satisfies NodeJS.ProcessEnv;

describe('loadDbEnv', () => {
  it('DATABASE_URL を優先して使う', () => {
    const env = loadDbEnv({
      ...baseSecret,
      DATABASE_URL: 'postgres://u:p@db:5432/app',
      POSTGRES_USER: 'ignored',
    });
    expect(env.databaseUrl).toBe('postgres://u:p@db:5432/app');
    expect(env.sessionSecret).toBe('super-secret-value');
  });

  it('POSTGRES_* から接続文字列を組み立てる', () => {
    const env = loadDbEnv({
      ...baseSecret,
      POSTGRES_USER: 'pokedex',
      POSTGRES_PASSWORD: 'pw',
      POSTGRES_DB: 'pokedex',
      POSTGRES_HOST: 'localhost',
      POSTGRES_PORT: '5433',
    });
    expect(env.databaseUrl).toBe('postgres://pokedex:pw@localhost:5433/pokedex');
  });

  it('host / port 未指定時は既定値を使う', () => {
    const env = loadDbEnv({
      ...baseSecret,
      POSTGRES_USER: 'pokedex',
      POSTGRES_PASSWORD: 'pw',
      POSTGRES_DB: 'pokedex',
    });
    expect(env.databaseUrl).toBe('postgres://pokedex:pw@localhost:5432/pokedex');
  });

  it('host / port が空文字（trim 後）でも既定値へ倒す', () => {
    const env = loadDbEnv({
      ...baseSecret,
      POSTGRES_USER: 'pokedex',
      POSTGRES_PASSWORD: 'pw',
      POSTGRES_DB: 'pokedex',
      POSTGRES_HOST: '   ',
      POSTGRES_PORT: '',
    });
    expect(env.databaseUrl).toBe('postgres://pokedex:pw@localhost:5432/pokedex');
  });

  it('ユーザー名・パスワードを URL エンコードする', () => {
    const env = loadDbEnv({
      ...baseSecret,
      POSTGRES_USER: 'user@name',
      POSTGRES_PASSWORD: 'p@ss:word',
      POSTGRES_DB: 'pokedex',
    });
    expect(env.databaseUrl).toBe('postgres://user%40name:p%40ss%3Aword@localhost:5432/pokedex');
  });

  it('接続情報が全く無ければ例外を投げる', () => {
    expect(() => loadDbEnv({ ...baseSecret })).toThrow(/POSTGRES_USER/);
  });

  it('SESSION_SECRET が無ければ例外を投げる', () => {
    expect(() => loadDbEnv({ DATABASE_URL: 'postgres://u:p@db:5432/app' })).toThrow(
      /SESSION_SECRET/,
    );
  });
});
