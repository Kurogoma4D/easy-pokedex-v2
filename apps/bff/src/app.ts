import { Hono } from 'hono';

import { AuthService } from './auth/service.js';
import { PgAuthRepository, PgFavoriteRepository } from './auth/pg-repository.js';
import type { AuthRepository, FavoriteRepository } from './auth/repository.js';
import { getPool } from './db/pool.js';
import { PokeApiClient } from './pokeapi/index.js';
import { createAuthRoutes } from './routes/auth.js';
import { createFavoriteRoutes } from './routes/favorites.js';
import { createPokemonRoutes } from './routes/pokemon.js';

/** アプリ構築に注入する依存。テストはインメモリ実装を渡し、DB 無しで起動できる。 */
export interface AppDependencies {
  readonly pokeApiClient: PokeApiClient;
  readonly authRepository: AuthRepository;
  readonly favoriteRepository: FavoriteRepository;
}

/**
 * アプリ本体を構築する。認証・お気に入りのルートは注入されたリポジトリを使うため、
 * テストではインメモリ実装を渡して Postgres 無しで API を検証できる。
 */
export function createApp(deps: AppDependencies): Hono {
  const auth = new AuthService(deps.authRepository);
  const app = new Hono();

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'bff',
      timestamp: new Date().toISOString(),
    }),
  );

  app.route('/pokemon', createPokemonRoutes(deps.pokeApiClient));
  app.route('/auth', createAuthRoutes(auth));
  app.route('/favorites', createFavoriteRoutes(auth, deps.favoriteRepository));

  return app;
}

/**
 * 本番・開発で用いる既定アプリ。Postgres プールからリポジトリを構築する。
 * 参照時に初めてプールへアクセスするため、import だけでは DB 接続を要求しない。
 */
export function buildDefaultApp(): Hono {
  const pool = getPool();
  return createApp({
    pokeApiClient: new PokeApiClient(),
    authRepository: new PgAuthRepository(pool),
    favoriteRepository: new PgFavoriteRepository(pool),
  });
}
