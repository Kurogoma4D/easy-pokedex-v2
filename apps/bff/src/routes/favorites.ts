import { Hono } from 'hono';

import { requireAuth, type AuthVariables } from '../auth/middleware.js';
import type { FavoriteRepository } from '../auth/repository.js';
import type { AuthService } from '../auth/service.js';

/** pokemon_id の妥当範囲。図鑑番号は正の整数。極端な値は弾く。 */
const MAX_POKEMON_ID = 100000;

function parsePokemonId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (value < 1 || value > MAX_POKEMON_ID) {
    return null;
  }
  return value;
}

/**
 * お気に入り API（ログインユーザーに紐づく）。全ルートを `requireAuth` で保護し、
 * 未認証アクセスは 401 で拒否する。お気に入りは現在ユーザーのものだけを操作・取得する。
 */
export function createFavoriteRoutes(
  auth: AuthService,
  repo: FavoriteRepository,
): Hono<{ Variables: AuthVariables }> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.use('*', requireAuth(auth));

  // 現在ユーザーのお気に入り pokemon_id 一覧（新しい順）。
  routes.get('/', async (c) => {
    const favorites = await repo.listFavorites(c.get('userId'));
    return c.json({ pokemonIds: favorites.map((f) => f.pokemonId) });
  });

  // お気に入り登録。既存なら冪等。
  routes.put('/:pokemonId', async (c) => {
    const pokemonId = parsePokemonId(c.req.param('pokemonId'));
    if (pokemonId === null) {
      return c.json({ error: 'pokemonId must be a positive integer' }, 400);
    }
    await repo.addFavorite(c.get('userId'), pokemonId);
    return c.json({ pokemonId, favorite: true });
  });

  // お気に入り解除。
  routes.delete('/:pokemonId', async (c) => {
    const pokemonId = parsePokemonId(c.req.param('pokemonId'));
    if (pokemonId === null) {
      return c.json({ error: 'pokemonId must be a positive integer' }, 400);
    }
    await repo.removeFavorite(c.get('userId'), pokemonId);
    return c.json({ pokemonId, favorite: false });
  });

  return routes;
}
