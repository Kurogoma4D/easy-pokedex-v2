/**
 * お気に入り API（登録・解除・一覧取得）。
 *
 * ビジネスロジックは `FavoriteService` に委ね、本ルートは HTTP 表現
 * （リクエスト本文の取り出し・ステータス・JSON）への写像に限る。
 * 全エンドポイントを `requireAuth` でゲートし、未認証アクセスを 401 で拒否する。
 * 操作対象はログインユーザー本人のお気に入りに限定する（`c.get('user')` の id を用いる）。
 */

import { type Context, Hono } from 'hono';

import type { AuthVariables } from '../auth/index.js';
import { requireAuth } from '../auth/index.js';
import type { FavoriteService } from '../favorites/index.js';

interface FavoriteBody {
  pokemonId?: unknown;
}

/** リクエスト本文を JSON として安全に読む。本文不正時は空オブジェクトへ倒す。 */
async function readBody(c: Context): Promise<FavoriteBody> {
  try {
    const body = (await c.req.json()) as unknown;
    if (typeof body === 'object' && body !== null) {
      return body as FavoriteBody;
    }
  } catch {
    // 本文が JSON でない場合はバリデーションで弾く。
  }
  return {};
}

/** パスパラメータの pokemon_id を正の整数として解釈する。不正なら null。 */
function parsePathPokemonId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return id > 0 ? id : null;
}

export function createFavoriteRoutes(service: FavoriteService): Hono<{ Variables: AuthVariables }> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  // 全エンドポイントを認証必須にする。未認証は 401 で拒否する。
  routes.use('*', requireAuth());

  routes.get('/', async (c) => {
    // requireAuth 通過後は user が非 null であることが保証される。
    const user = c.get('user')!;
    const favorites = await service.list(user.id);
    return c.json({ favorites });
  });

  routes.post('/', async (c) => {
    const user = c.get('user')!;
    const { pokemonId } = await readBody(c);
    const result = await service.add(user.id, pokemonId);
    if (!result.ok) {
      return c.json({ error: 'pokemonId must be a positive integer' }, 400);
    }
    return c.body(null, 204);
  });

  routes.delete('/:pokemonId', async (c) => {
    const user = c.get('user')!;
    const pokemonId = parsePathPokemonId(c.req.param('pokemonId'));
    if (pokemonId === null) {
      return c.json({ error: 'pokemonId must be a positive integer' }, 400);
    }
    await service.remove(user.id, pokemonId);
    return c.body(null, 204);
  });

  return routes;
}
