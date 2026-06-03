import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import {
  PokeApiClient,
  PokeApiError,
  fetchPokemonDetail,
  fetchPokemonList,
  searchPokemon,
} from '../pokeapi/index.js';
import type { PokemonSearchParams } from '../pokeapi/index.js';

/** 一覧 1 ページの既定件数。無限スクロールの 1 バッチに相当する。 */
const DEFAULT_LIMIT = 20;
/** 1 ページで取得を許可する最大件数。上流負荷・レイテンシの上限を設ける。 */
const MAX_LIMIT = 100;

/**
 * 1 検索で受け付ける `type` の最大数。タイプは AND 積集合で扱い 1 つにつき上流 1 リクエストの
 * ファンアウトが発生するため、無制限な指定で上流負荷が膨らむのを防ぐ。超過時は 400 を返す。
 */
const MAX_TYPE_PARAMS = 5;

/**
 * `generation` パラメータの許容形。PokeAPI の世代名（`generation-i` 等）または数値 id に限り、
 * 想定外の文字列で上流へ無駄打ちしないよう入力段で弾く。
 */
const GENERATION_PATTERN = /^(generation-[a-z]+|\d+)$/;

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

  // 検索・フィルタ（FR-2）。`type` は複数指定（`?type=grass&type=poison`）を AND で扱う。
  // 静的ルートのため `/:idOrName` より前に登録し、`search` が動的ルートに食われないようにする。
  routes.get('/search', async (c) => {
    const limit = parseNonNegativeInt(c.req.query('limit'), DEFAULT_LIMIT);
    const offset = parseNonNegativeInt(c.req.query('offset'), 0);

    if (limit === null || offset === null) {
      return c.json({ error: 'limit and offset must be non-negative integers' }, 400);
    }
    if (limit < 1 || limit > MAX_LIMIT) {
      return c.json({ error: `limit must be between 1 and ${MAX_LIMIT}` }, 400);
    }

    const name = c.req.query('name');
    const rawTypes = (c.req.queries('type') ?? []).filter((t) => t.trim() !== '');
    const generation = c.req.query('generation');

    if (rawTypes.length > MAX_TYPE_PARAMS) {
      return c.json({ error: `at most ${MAX_TYPE_PARAMS} type values are allowed` }, 400);
    }

    const trimmedGeneration =
      generation !== undefined && generation.trim() !== '' ? generation.trim() : undefined;
    if (trimmedGeneration !== undefined && !GENERATION_PATTERN.test(trimmedGeneration)) {
      return c.json(
        { error: 'generation must be a generation name (e.g. generation-i) or a numeric id' },
        400,
      );
    }

    const params: PokemonSearchParams = {
      name: name !== undefined && name.trim() !== '' ? name : undefined,
      types: rawTypes,
      generation: trimmedGeneration,
      limit,
      offset,
    };

    try {
      const result = await searchPokemon(client, params);
      return c.json(result);
    } catch (error) {
      if (error instanceof PokeApiError) {
        return c.json({ error: 'failed to search pokemon from upstream' }, mapErrorStatus(error));
      }
      throw error;
    }
  });

  // 詳細は id または name で引く（FR-3）。`/list` `/search` を上に置き、静的ルートを優先させる。
  routes.get('/:idOrName', async (c) => {
    const idOrName = c.req.param('idOrName').trim().toLowerCase();
    if (idOrName === '') {
      return c.json({ error: 'idOrName must not be empty' }, 400);
    }

    try {
      const result = await fetchPokemonDetail(client, idOrName);
      return c.json(result);
    } catch (error) {
      if (error instanceof PokeApiError) {
        return c.json(
          { error: 'failed to fetch pokemon detail from upstream' },
          mapErrorStatus(error),
        );
      }
      throw error;
    }
  });

  return routes;
}
