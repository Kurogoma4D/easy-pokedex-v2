/**
 * お気に入りのユースケース（登録・解除・一覧取得）。
 *
 * pokemon_id の入力検証と永続化を束ね、ルート層へは結果型を返す。
 * ルート層はこの結果を HTTP（ステータス・本文）へ写像するだけにする。
 */

import type { FavoriteRecord, FavoriteRepository } from './repository.js';

export interface FavoriteItem {
  readonly pokemonId: number;
}

export type AddFavoriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind: 'invalid_pokemon_id' };

export type RemoveFavoriteResult = { readonly ok: true };

/**
 * pokemon_id として受理する値を検証する。PokeAPI の図鑑番号は正の整数のため、
 * 整数でない・0 以下の値は弾く。
 */
function parsePokemonId(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function toItem(record: FavoriteRecord): FavoriteItem {
  return { pokemonId: record.pokemonId };
}

export class FavoriteService {
  constructor(private readonly repo: FavoriteRepository) {}

  async add(userId: number, pokemonId: unknown): Promise<AddFavoriteResult> {
    const id = parsePokemonId(pokemonId);
    if (id === null) {
      return { ok: false, kind: 'invalid_pokemon_id' };
    }
    await this.repo.add(userId, id);
    return { ok: true };
  }

  async remove(userId: number, pokemonId: number): Promise<RemoveFavoriteResult> {
    await this.repo.remove(userId, pokemonId);
    return { ok: true };
  }

  /** ユーザーのお気に入り一覧を登録日時の新しい順で返す。 */
  async list(userId: number): Promise<FavoriteItem[]> {
    const records = await this.repo.list(userId);
    return records.map(toItem);
  }
}
