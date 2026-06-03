import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { PokeApiClient, PokeApiError, fetchPokemonList } from '../pokeapi/index.js';

/** 一覧 1 ページの既定件数。無限スクロールの 1 バッチに相当する。 */
const DEFAULT_LIMIT = 20;
/** 1 ページで取得を許可する最大件数。上流負荷・レイテンシの上限を設ける。 */
const MAX_LIMIT = 100;

/** クエリ文字列を非負整数として解釈する。未指定なら fallback、不正なら null。 */
function parseNonNegativeInt(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  return Number(raw);
}

/**
 * 上流エラーをクライアントへ返すステータスへ写像する。
 * 上流の 4xx はそのまま伝え、5xx・タイムアウト・ネットワーク断などは 502 Bad Gateway にまとめる。
 */
function mapErrorStatus(error: PokeApiError): ContentfulStatusCode {
  if (
    error.kind === 'http' &&
    error.status !== undefined &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return error.status as ContentfulStatusCode;
  }
  return 502;
}

export function createPokemonRoutes(client: PokeApiClient): Hono {
  const routes = new Hono();

  routes.get('/list', async (c) => {
    const limit = parseNonNegativeInt(c.req.query('limit'), DEFAULT_LIMIT);
    const offset = parseNonNegativeInt(c.req.query('offset'), 0);

    if (limit === null || offset === null) {
      return c.json({ error: 'limit and offset must be non-negative integers' }, 400);
    }
    if (limit < 1 || limit > MAX_LIMIT) {
      return c.json({ error: `limit must be between 1 and ${MAX_LIMIT}` }, 400);
    }

    try {
      const result = await fetchPokemonList(client, { limit, offset });
      return c.json(result);
    } catch (error) {
      if (error instanceof PokeApiError) {
        return c.json(
          { error: 'failed to fetch pokemon list from upstream' },
          mapErrorStatus(error),
        );
      }
      throw error;
    }
  });

  return routes;
}
