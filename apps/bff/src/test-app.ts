import type { Hono } from 'hono';

import { InMemoryRepository } from './auth/memory-repository.js';
import { createApp } from './app.js';
import { PokeApiClient } from './pokeapi/index.js';

/**
 * テスト用にインメモリ・リポジトリで構成したアプリを作る。Postgres 無しで認証・お気に入り API を
 * 検証できる。リポジトリも返すため、テスト側で事前状態の確認・操作に使える。
 */
export function createTestApp(): { app: Hono; repo: InMemoryRepository } {
  const repo = new InMemoryRepository();
  const app = createApp({
    pokeApiClient: new PokeApiClient(),
    authRepository: repo,
    favoriteRepository: repo,
  });
  return { app, repo };
}
