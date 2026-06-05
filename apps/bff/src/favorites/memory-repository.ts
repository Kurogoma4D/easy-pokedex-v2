/**
 * `FavoriteRepository` のインメモリ実装。テスト専用で、DB を起動せずに
 * お気に入りロジック（登録・解除・一覧）を検証するために用いる。
 *
 * 登録・解除は Postgres 実装と同じく冪等にし、一覧は登録日時の新しい順で返す。
 */

import type { FavoriteRecord, FavoriteRepository } from './repository.js';

export function createMemoryFavoriteRepository(): FavoriteRepository {
  // user_id -> (pokemon_id -> 登録日時)。
  const byUser = new Map<number, Map<number, Date>>();

  return {
    add(userId, pokemonId) {
      let favorites = byUser.get(userId);
      if (favorites === undefined) {
        favorites = new Map<number, Date>();
        byUser.set(userId, favorites);
      }
      if (!favorites.has(pokemonId)) {
        favorites.set(pokemonId, new Date());
      }
      return Promise.resolve();
    },

    remove(userId, pokemonId) {
      byUser.get(userId)?.delete(pokemonId);
      return Promise.resolve();
    },

    list(userId) {
      const favorites = byUser.get(userId);
      if (favorites === undefined) {
        return Promise.resolve([]);
      }
      const records: FavoriteRecord[] = Array.from(favorites, ([pokemonId, createdAt]) => ({
        pokemonId,
        createdAt,
      }));
      records.sort((a, b) => {
        const diff = b.createdAt.getTime() - a.createdAt.getTime();
        return diff !== 0 ? diff : b.pokemonId - a.pokemonId;
      });
      return Promise.resolve(records);
    },
  };
}
