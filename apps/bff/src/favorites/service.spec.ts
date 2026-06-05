import { describe, expect, it } from 'vitest';

import { createMemoryFavoriteRepository } from './memory-repository.js';
import { FavoriteService } from './service.js';

function buildService(): FavoriteService {
  return new FavoriteService(createMemoryFavoriteRepository());
}

describe('FavoriteService', () => {
  it('登録したお気に入りが一覧に現れる', async () => {
    const service = buildService();
    const add = await service.add(1, 25);
    expect(add.ok).toBe(true);

    const favorites = await service.list(1);
    expect(favorites).toEqual([{ pokemonId: 25 }]);
  });

  it('同じ pokemon の重複登録は冪等で 1 件のまま', async () => {
    const service = buildService();
    await service.add(1, 25);
    await service.add(1, 25);

    expect(await service.list(1)).toHaveLength(1);
  });

  it('整数でない pokemonId は登録を拒否する', async () => {
    const service = buildService();
    expect(await service.add(1, 1.5)).toEqual({ ok: false, kind: 'invalid_pokemon_id' });
    expect(await service.add(1, 0)).toEqual({ ok: false, kind: 'invalid_pokemon_id' });
    expect(await service.add(1, -3)).toEqual({ ok: false, kind: 'invalid_pokemon_id' });
    expect(await service.add(1, 'pikachu')).toEqual({ ok: false, kind: 'invalid_pokemon_id' });
    expect(await service.list(1)).toEqual([]);
  });

  it('解除したお気に入りは一覧から消える', async () => {
    const service = buildService();
    await service.add(1, 25);
    await service.add(1, 4);
    await service.remove(1, 25);

    expect(await service.list(1)).toEqual([{ pokemonId: 4 }]);
  });

  it('未登録の解除はエラーにならない（冪等）', async () => {
    const service = buildService();
    const result = await service.remove(1, 999);
    expect(result.ok).toBe(true);
  });

  it('ユーザーごとにお気に入りが分離される', async () => {
    const service = buildService();
    await service.add(1, 25);
    await service.add(2, 4);

    expect(await service.list(1)).toEqual([{ pokemonId: 25 }]);
    expect(await service.list(2)).toEqual([{ pokemonId: 4 }]);
  });
});
