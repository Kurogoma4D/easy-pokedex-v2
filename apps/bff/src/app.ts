import { Hono } from 'hono';

import {
  AuthService,
  type AuthVariables,
  createPgAuthRepository,
  sessionResolver,
} from './auth/index.js';
import { getDbClient } from './db/index.js';
import { FavoriteService, createPgFavoriteRepository } from './favorites/index.js';
import { PokeApiClient } from './pokeapi/index.js';
import { createAuthRoutes } from './routes/auth.js';
import { createFavoriteRoutes } from './routes/favorites.js';
import { createPokemonRoutes } from './routes/pokemon.js';

export interface AppDeps {
  readonly authService: AuthService;
  readonly favoriteService: FavoriteService;
  readonly pokeApiClient: PokeApiClient;
}

/** 依存を受け取りアプリを構築する。テストではインメモリのリポジトリ等を差し込む。 */
export function createApp(deps: AppDeps): Hono<{ Variables: AuthVariables }> {
  const app = new Hono<{ Variables: AuthVariables }>();

  // 全リクエストでセッションを解決し、`c.get('user')` を利用可能にする。
  app.use('*', sessionResolver(deps.authService));

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'bff',
      timestamp: new Date().toISOString(),
    }),
  );

  app.route('/auth', createAuthRoutes(deps.authService));
  app.route('/favorites', createFavoriteRoutes(deps.favoriteService));
  app.route('/pokemon', createPokemonRoutes(deps.pokeApiClient));

  return app;
}

/**
 * 本番用アプリ。認証は Postgres リポジトリで構築する。DB クライアントは遅延初期化のため、
 * アプリ構築時点では接続を確立しない（リクエスト処理で初めて使われる）。
 */
export const app = createApp({
  authService: new AuthService(createPgAuthRepository(getDbClient)),
  favoriteService: new FavoriteService(createPgFavoriteRepository(getDbClient)),
  pokeApiClient: new PokeApiClient(),
});
