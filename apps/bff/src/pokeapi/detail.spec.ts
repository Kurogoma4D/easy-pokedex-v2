import { describe, expect, it, vi } from 'vitest';

import { PokeApiClient } from './client.js';
import { computeTypeMatchups, fetchPokemonDetail } from './detail.js';
import { buildLocalizedFlavorText, buildLocalizedGenus, formatFlavorText } from './localization.js';
import type {
  PokeApiFlavorTextEntry,
  PokeApiGenus,
  PokeApiName,
  PokeApiNamedResource,
  PokeApiType,
} from './types.js';

const UPSTREAM = 'https://upstream.test/api/v2';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

interface PokemonFixture {
  readonly id: number;
  readonly name: string;
  readonly jaName: string;
  readonly enName: string;
  readonly types: readonly string[];
  readonly abilities: readonly { readonly name: string; readonly isHidden: boolean }[];
  readonly stats: readonly { readonly name: string; readonly base: number }[];
  readonly artwork?: string | null;
  readonly frontDefault?: string | null;
  readonly flavorTextEntries?: readonly {
    readonly flavorText: string;
    readonly language: string;
    readonly version: string;
  }[];
  readonly genera?: readonly { readonly genus: string; readonly language: string }[];
  readonly generation?: string;
  readonly isLegendary?: boolean;
  readonly isMythical?: boolean;
  /** 鳴き声音源。未指定なら上流レスポンスに cries を含めない（音源欠落を再現する）。 */
  readonly cries?: { readonly latest?: string | null; readonly legacy?: string | null };
}

const BULBASAUR: PokemonFixture = {
  id: 1,
  name: 'bulbasaur',
  jaName: 'フシギダネ',
  enName: 'Bulbasaur',
  types: ['grass', 'poison'],
  abilities: [
    { name: 'overgrow', isHidden: false },
    { name: 'chlorophyll', isHidden: true },
  ],
  stats: [
    { name: 'hp', base: 45 },
    { name: 'attack', base: 49 },
    { name: 'defense', base: 49 },
  ],
  artwork: 'https://img.test/artwork/1.png',
  frontDefault: 'https://img.test/sprite/1.png',
  flavorTextEntries: [
    // 同一言語の複数バージョン。最新側（最後の出現）が代表として選ばれることを確認するため、
    // 古いバージョンを先に、新しいバージョンを後に置く。
    {
      flavorText: 'A strange\nseed was\fplanted.',
      language: 'en',
      version: 'red',
    },
    {
      flavorText: 'There is a\nplant seed on\fits back.',
      language: 'en',
      version: 'shield',
    },
    {
      flavorText: 'うまれたときから\nせなかに\f しょくぶつの たねが あって、',
      language: 'ja-Hrkt',
      version: 'shield',
    },
  ],
  genera: [
    { genus: 'たねポケモン', language: 'ja-Hrkt' },
    { genus: 'Seed Pokémon', language: 'en' },
  ],
  generation: 'generation-i',
  isLegendary: false,
  isMythical: false,
  cries: {
    latest: 'https://cry.test/latest/1.ogg',
    legacy: 'https://cry.test/legacy/1.ogg',
  },
};

const IVYSAUR: PokemonFixture = {
  id: 2,
  name: 'ivysaur',
  jaName: 'フシギソウ',
  enName: 'Ivysaur',
  types: ['grass', 'poison'],
  abilities: [{ name: 'overgrow', isHidden: false }],
  stats: [{ name: 'hp', base: 60 }],
  artwork: null,
  frontDefault: 'https://img.test/sprite/2.png',
};

const VENUSAUR: PokemonFixture = {
  id: 3,
  name: 'venusaur',
  jaName: 'フシギバナ',
  enName: 'Venusaur',
  types: ['grass', 'poison'],
  abilities: [{ name: 'overgrow', isHidden: false }],
  stats: [{ name: 'hp', base: 80 }],
  artwork: 'https://img.test/artwork/3.png',
  frontDefault: 'https://img.test/sprite/3.png',
};

const FIXTURES = [BULBASAUR, IVYSAUR, VENUSAUR] as const;

interface DamageRelationsFixture {
  readonly double_damage_from: readonly { readonly name: string; readonly url: string }[];
  readonly half_damage_from: readonly { readonly name: string; readonly url: string }[];
  readonly no_damage_from: readonly { readonly name: string; readonly url: string }[];
}

const EMPTY_DAMAGE_RELATIONS: DamageRelationsFixture = {
  double_damage_from: [],
  half_damage_from: [],
  no_damage_from: [],
};

const TYPE_NAMES: Record<
  string,
  { ja: string; en: string; damageRelations: DamageRelationsFixture }
> = {
  grass: { ja: 'くさ', en: 'grass', damageRelations: EMPTY_DAMAGE_RELATIONS },
  poison: { ja: 'どく', en: 'poison', damageRelations: EMPTY_DAMAGE_RELATIONS },
};

const ABILITY_NAMES: Record<string, { ja: string; en: string }> = {
  overgrow: { ja: 'しんりょく', en: 'Overgrow' },
  chlorophyll: { ja: 'ようりょくそ', en: 'Chlorophyll' },
};

function pokemonBody(f: PokemonFixture): unknown {
  return {
    id: f.id,
    name: f.name,
    height: f.id * 7,
    weight: f.id * 69,
    base_experience: 64,
    types: f.types.map((name, index) => ({ slot: index + 1, type: { name, url: '' } })),
    stats: f.stats.map((s) => ({ base_stat: s.base, effort: 0, stat: { name: s.name, url: '' } })),
    abilities: f.abilities.map((a, index) => ({
      is_hidden: a.isHidden,
      slot: index + 1,
      ability: { name: a.name, url: '' },
    })),
    sprites: {
      front_default: f.frontDefault ?? null,
      front_shiny: null,
      other: { 'official-artwork': { front_default: f.artwork ?? null } },
    },
    // cries 未指定のフィクスチャでは上流レスポンスからキー自体を省き、音源欠落を再現する。
    ...(f.cries !== undefined
      ? { cries: { latest: f.cries.latest ?? null, legacy: f.cries.legacy ?? null } }
      : {}),
    species: { name: f.name, url: `${UPSTREAM}/pokemon-species/${f.id}/` },
  };
}

function speciesBody(f: PokemonFixture): unknown {
  return {
    id: f.id,
    name: f.name,
    names: [
      { name: f.jaName, language: { name: 'ja-Hrkt', url: '' } },
      { name: f.enName, language: { name: 'en', url: '' } },
    ],
    genera: (f.genera ?? []).map((g) => ({
      genus: g.genus,
      language: { name: g.language, url: '' },
    })),
    flavor_text_entries: (f.flavorTextEntries ?? []).map((e) => ({
      flavor_text: e.flavorText,
      language: { name: e.language, url: '' },
      version: { name: e.version, url: '' },
    })),
    generation: { name: f.generation ?? 'generation-i', url: '' },
    evolution_chain: { url: `${UPSTREAM}/evolution-chain/1/` },
    is_legendary: f.isLegendary ?? false,
    is_mythical: f.isMythical ?? false,
  };
}

/** Bulbasaur → Ivysaur → Venusaur の直線進化チェーン。 */
function evolutionChainBody(): unknown {
  return {
    id: 1,
    chain: {
      species: { name: 'bulbasaur', url: `${UPSTREAM}/pokemon-species/1/` },
      evolves_to: [
        {
          species: { name: 'ivysaur', url: `${UPSTREAM}/pokemon-species/2/` },
          evolves_to: [
            {
              species: { name: 'venusaur', url: `${UPSTREAM}/pokemon-species/3/` },
              evolves_to: [],
            },
          ],
        },
      ],
    },
  };
}

function makeFetchImpl() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const path = new URL(String(input)).pathname;

    const evoMatch = /\/evolution-chain\/(\d+)\/?$/.exec(path);
    if (evoMatch !== null) {
      return jsonResponse(evolutionChainBody());
    }

    const typeMatch = /\/type\/([^/]+)\/?$/.exec(path);
    if (typeMatch !== null) {
      const key = typeMatch[1]!;
      const t = TYPE_NAMES[key];
      if (t === undefined) return new Response('not found', { status: 404 });
      return jsonResponse({
        id: 1,
        name: key,
        names: [
          { name: t.ja, language: { name: 'ja-Hrkt', url: '' } },
          { name: t.en, language: { name: 'en', url: '' } },
        ],
        damage_relations: t.damageRelations,
        pokemon: [],
      });
    }

    const abilityMatch = /\/ability\/([^/]+)\/?$/.exec(path);
    if (abilityMatch !== null) {
      const key = abilityMatch[1]!;
      const a = ABILITY_NAMES[key];
      if (a === undefined) return new Response('not found', { status: 404 });
      return jsonResponse({
        id: 1,
        name: key,
        names: [
          { name: a.ja, language: { name: 'ja-Hrkt', url: '' } },
          { name: a.en, language: { name: 'en', url: '' } },
        ],
      });
    }

    const speciesMatch = /\/pokemon-species\/([^/]+)\/?$/.exec(path);
    if (speciesMatch !== null) {
      const key = speciesMatch[1]!;
      const f = FIXTURES.find((x) => x.name === key || String(x.id) === key);
      if (f === undefined) return new Response('not found', { status: 404 });
      return jsonResponse(speciesBody(f));
    }

    const pokemonMatch = /\/pokemon\/([^/]+)\/?$/.exec(path);
    if (pokemonMatch !== null) {
      const key = pokemonMatch[1]!;
      const f = FIXTURES.find((x) => x.name === key || String(x.id) === key);
      if (f === undefined) return new Response('not found', { status: 404 });
      return jsonResponse(pokemonBody(f));
    }

    return new Response('not found', { status: 404 });
  });
}

function makeClient(fetchImpl: ReturnType<typeof makeFetchImpl>): PokeApiClient {
  return new PokeApiClient({
    baseUrl: UPSTREAM,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

describe('fetchPokemonDetail', () => {
  it('aggregates number, name, image, types, stats, abilities and evolution into one response', async () => {
    const client = makeClient(makeFetchImpl());

    const detail = await fetchPokemonDetail(client, 'bulbasaur');

    expect(detail.id).toBe(1);
    expect(detail.name).toEqual({ ja: 'フシギダネ', en: 'Bulbasaur' });
    expect(detail.imageUrl).toBe('https://img.test/artwork/1.png');
    expect(detail.height).toBe(7);
    expect(detail.weight).toBe(69);

    expect(detail.stats).toEqual([
      { id: 'hp', base: 45 },
      { id: 'attack', base: 49 },
      { id: 'defense', base: 49 },
    ]);
  });

  it('includes the cry url, preferring cries.latest over legacy', async () => {
    const client = makeClient(makeFetchImpl());

    const detail = await fetchPokemonDetail(client, 'bulbasaur');

    expect(detail.cryUrl).toBe('https://cry.test/latest/1.ogg');
  });

  it('falls back the cry url to cries.legacy when latest is missing', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (/\/pokemon\/1\/?$/.test(path)) {
        const body = pokemonBody(BULBASAUR) as Record<string, unknown>;
        body.cries = { latest: null, legacy: 'https://cry.test/legacy/1.ogg' };
        return jsonResponse(body);
      }
      return makeFetchImpl()(input);
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const detail = await fetchPokemonDetail(client, 1);

    expect(detail.cryUrl).toBe('https://cry.test/legacy/1.ogg');
  });

  it('treats an empty-string latest as missing and falls back the cry url to cries.legacy', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (/\/pokemon\/1\/?$/.test(path)) {
        const body = pokemonBody(BULBASAUR) as Record<string, unknown>;
        body.cries = { latest: '', legacy: 'https://cry.test/legacy/1.ogg' };
        return jsonResponse(body);
      }
      return makeFetchImpl()(input);
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const detail = await fetchPokemonDetail(client, 1);

    expect(detail.cryUrl).toBe('https://cry.test/legacy/1.ogg');
  });

  it('returns a null cry url when both latest and legacy are empty strings', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (/\/pokemon\/1\/?$/.test(path)) {
        const body = pokemonBody(BULBASAUR) as Record<string, unknown>;
        body.cries = { latest: '', legacy: '' };
        return jsonResponse(body);
      }
      return makeFetchImpl()(input);
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const detail = await fetchPokemonDetail(client, 1);

    expect(detail.cryUrl).toBeNull();
  });

  it('includes localized dex info (flavor text, genus, generation, legendary/mythical) from species', async () => {
    const client = makeClient(makeFetchImpl());

    const detail = await fetchPokemonDetail(client, 'bulbasaur');

    expect(detail.generation).toBe('generation-i');
    expect(detail.isLegendary).toBe(false);
    expect(detail.isMythical).toBe(false);
    expect(detail.genus).toEqual({ ja: 'たねポケモン', en: 'Seed Pokémon' });
    // 改行・改ページ制御文字が単一スペースへ畳まれ、同一言語の最新版が選ばれる。
    expect(detail.flavorText).toEqual({
      ja: 'うまれたときから せなかに しょくぶつの たねが あって、',
      en: 'There is a plant seed on its back.',
    });
  });

  it('returns proper nouns (types and abilities) in both ja and en', async () => {
    const client = makeClient(makeFetchImpl());

    const detail = await fetchPokemonDetail(client, 1);

    expect(detail.types).toEqual([
      { id: 'grass', name: { ja: 'くさ', en: 'grass' } },
      { id: 'poison', name: { ja: 'どく', en: 'poison' } },
    ]);

    expect(detail.abilities).toEqual([
      { id: 'overgrow', name: { ja: 'しんりょく', en: 'Overgrow' }, isHidden: false },
      { id: 'chlorophyll', name: { ja: 'ようりょくそ', en: 'Chlorophyll' }, isHidden: true },
    ]);
  });

  it('builds the full evolution chain tree with localized names and images', async () => {
    const client = makeClient(makeFetchImpl());

    const detail = await fetchPokemonDetail(client, 'bulbasaur');

    const root = detail.evolutionChain;
    expect(root.id).toBe(1);
    expect(root.name).toEqual({ ja: 'フシギダネ', en: 'Bulbasaur' });
    expect(root.imageUrl).toBe('https://img.test/artwork/1.png');
    expect(root.evolvesTo).toHaveLength(1);

    const stage2 = root.evolvesTo[0]!;
    expect(stage2.id).toBe(2);
    expect(stage2.name).toEqual({ ja: 'フシギソウ', en: 'Ivysaur' });
    // Ivysaur has no official artwork; falls back to front_default.
    expect(stage2.imageUrl).toBe('https://img.test/sprite/2.png');
    expect(stage2.evolvesTo).toHaveLength(1);

    const stage3 = stage2.evolvesTo[0]!;
    expect(stage3.id).toBe(3);
    expect(stage3.name).toEqual({ ja: 'フシギバナ', en: 'Venusaur' });
    expect(stage3.evolvesTo).toEqual([]);
  });

  it('resolves the species by the pokemon.species reference, not the requested key', async () => {
    const fetchImpl = makeFetchImpl();
    const client = makeClient(fetchImpl);

    await fetchPokemonDetail(client, 'bulbasaur');

    const speciesCalls = fetchImpl.mock.calls.filter((call) =>
      String(call[0]).includes('/pokemon-species/'),
    );
    // 起点 species は 1 度のみ。進化メンバー(2,3)が各 1 度ずつ。起点の重複取得をしない。
    expect(speciesCalls.length).toBe(3);
  });

  it('does not exceed the configured upstream concurrency during fan-out', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const concurrency = 2;

    const base = makeFetchImpl();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      // 起点の pokemon/species/evolution-chain は逐次取得でファンアウト前なので計測から除く。
      const isFanOut = /\/type\/|\/ability\/|\/pokemon-species\/[23]\/|\/pokemon\/[23]\//.test(
        path,
      );
      if (isFanOut) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
      }
      try {
        return await base(input);
      } finally {
        if (isFanOut) inFlight -= 1;
      }
    });

    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    await fetchPokemonDetail(client, 'bulbasaur', undefined, concurrency);

    expect(maxInFlight).toBeLessThanOrEqual(concurrency);
    expect(maxInFlight).toBeGreaterThan(0);
  });

  it('falls back type/ability display names to the identifier when upstream lacks names', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (/\/type\//.test(path)) {
        return jsonResponse({
          id: 1,
          name: 'mystery',
          names: [],
          damage_relations: {
            double_damage_from: [],
            half_damage_from: [],
            no_damage_from: [],
          },
          pokemon: [],
        });
      }
      if (/\/ability\//.test(path)) {
        return jsonResponse({ id: 1, name: 'mystery', names: [] });
      }
      if (/\/evolution-chain\//.test(path)) {
        return jsonResponse({
          id: 9,
          chain: {
            species: { name: 'loner', url: `${UPSTREAM}/pokemon-species/99/` },
            evolves_to: [],
          },
        });
      }
      if (/\/pokemon-species\//.test(path)) {
        return jsonResponse({
          id: 99,
          name: 'loner',
          names: [{ name: 'Loner', language: { name: 'en', url: '' } }],
          flavor_text_entries: [],
          generation: { name: 'generation-i', url: '' },
          evolution_chain: { url: `${UPSTREAM}/evolution-chain/9/` },
          is_legendary: false,
          is_mythical: false,
        });
      }
      return jsonResponse({
        id: 99,
        name: 'loner',
        height: 10,
        weight: 20,
        base_experience: 1,
        types: [{ slot: 1, type: { name: 'mysterytype', url: '' } }],
        stats: [{ base_stat: 1, effort: 0, stat: { name: 'hp', url: '' } }],
        abilities: [{ is_hidden: false, slot: 1, ability: { name: 'mysteryability', url: '' } }],
        sprites: { front_default: null, front_shiny: null },
        species: { name: 'loner', url: `${UPSTREAM}/pokemon-species/99/` },
      });
    });
    const client = makeClient(fetchImpl as unknown as ReturnType<typeof makeFetchImpl>);

    const detail = await fetchPokemonDetail(client, 'loner');

    expect(detail.types).toEqual([
      { id: 'mysterytype', name: { ja: 'mysterytype', en: 'mysterytype' } },
    ]);
    expect(detail.abilities).toEqual([
      {
        id: 'mysteryability',
        name: { ja: 'mysteryability', en: 'mysteryability' },
        isHidden: false,
      },
    ]);
    expect(detail.imageUrl).toBeNull();
    expect(detail.cryUrl).toBeNull();
    expect(detail.evolutionChain.id).toBe(99);
    expect(detail.evolutionChain.evolvesTo).toEqual([]);
  });
});

function ref(name: string): PokeApiNamedResource {
  return { name, url: `${UPSTREAM}/type/${name}/` };
}

function typeNamesOf(...names: readonly string[]): PokeApiName[] {
  return names.length === 0
    ? []
    : [
        { name: `${names[0]!}-ja`, language: { name: 'ja-Hrkt', url: '' } },
        { name: `${names[0]!}-en`, language: { name: 'en', url: '' } },
      ];
}

/** localized 名は `${id}-ja` / `${id}-en` を持つ `/type` レスポンスを作る。names を空にすると識別子フォールバックになる。 */
function makeType(
  id: string,
  damage: {
    readonly double?: readonly string[];
    readonly half?: readonly string[];
    readonly no?: readonly string[];
  },
  options: { readonly withNames?: boolean } = {},
): PokeApiType {
  const withNames = options.withNames ?? true;
  return {
    id: 1,
    name: id,
    names: withNames ? typeNamesOf(id) : [],
    damage_relations: {
      double_damage_from: (damage.double ?? []).map(ref),
      half_damage_from: (damage.half ?? []).map(ref),
      no_damage_from: (damage.no ?? []).map(ref),
    },
    pokemon: [],
  };
}

function typeMap(...types: readonly PokeApiType[]): Map<string, PokeApiType> {
  return new Map(types.map((t) => [t.name, t]));
}

describe('computeTypeMatchups', () => {
  it('classifies x2 / x0.5 / x0 for a single-type defender', () => {
    const ground = makeType('ground', {
      double: ['water', 'grass', 'ice'],
      half: ['poison', 'rock'],
      no: ['electric'],
    });
    const attackers = typeMap(
      ground,
      makeType('water', {}),
      makeType('grass', {}),
      makeType('ice', {}),
      makeType('poison', {}),
      makeType('rock', {}),
      makeType('electric', {}),
    );

    const matchups = computeTypeMatchups(['ground'], attackers);

    expect(matchups.weaknesses).toEqual([
      {
        multiplier: 2,
        types: [
          { id: 'water', name: { ja: 'water-ja', en: 'water-en' } },
          { id: 'grass', name: { ja: 'grass-ja', en: 'grass-en' } },
          { id: 'ice', name: { ja: 'ice-ja', en: 'ice-en' } },
        ],
      },
    ]);
    expect(matchups.resistances).toEqual([
      {
        multiplier: 0.5,
        types: [
          { id: 'poison', name: { ja: 'poison-ja', en: 'poison-en' } },
          { id: 'rock', name: { ja: 'rock-ja', en: 'rock-en' } },
        ],
      },
    ]);
    expect(matchups.immunities).toEqual([
      {
        multiplier: 0,
        types: [{ id: 'electric', name: { ja: 'electric-ja', en: 'electric-en' } }],
      },
    ]);
  });

  it('composes x4 and x0.25 for a dual-type defender', () => {
    // 両タイプが fire に 2 倍 → ×4、両タイプが water に 0.5 倍 → ×0.25。
    const a = makeType('a', { double: ['fire'], half: ['water'] });
    const b = makeType('b', { double: ['fire'], half: ['water'] });
    const attackers = typeMap(a, b, makeType('fire', {}), makeType('water', {}));

    const matchups = computeTypeMatchups(['a', 'b'], attackers);

    expect(matchups.weaknesses).toEqual([
      { multiplier: 4, types: [{ id: 'fire', name: { ja: 'fire-ja', en: 'fire-en' } }] },
    ]);
    expect(matchups.resistances).toEqual([
      { multiplier: 0.25, types: [{ id: 'water', name: { ja: 'water-ja', en: 'water-en' } }] },
    ]);
    expect(matchups.immunities).toEqual([]);
  });

  it('cancels x2 and x0.5 to neutral (x1) and excludes it', () => {
    const a = makeType('a', { double: ['fire'] });
    const b = makeType('b', { half: ['fire'] });
    const attackers = typeMap(a, b, makeType('fire', {}));

    const matchups = computeTypeMatchups(['a', 'b'], attackers);

    expect(matchups.weaknesses).toEqual([]);
    expect(matchups.resistances).toEqual([]);
    expect(matchups.immunities).toEqual([]);
  });

  it('preserves immunity (x0) even when the other type multiplies up', () => {
    const a = makeType('a', { no: ['ghost'] });
    const b = makeType('b', { double: ['ghost'] });
    const attackers = typeMap(a, b, makeType('ghost', {}));

    const matchups = computeTypeMatchups(['a', 'b'], attackers);

    expect(matchups.weaknesses).toEqual([]);
    expect(matchups.resistances).toEqual([]);
    expect(matchups.immunities).toEqual([
      { multiplier: 0, types: [{ id: 'ghost', name: { ja: 'ghost-ja', en: 'ghost-en' } }] },
    ]);
  });

  it('orders weakness groups by multiplier descending and falls back names to the identifier', () => {
    // x4: 両方が super、x2: 片方だけが super。fire の名前は欠落させて識別子フォールバックを確認する。
    const a = makeType('a', { double: ['fire', 'ice'] });
    const b = makeType('b', { double: ['fire'] });
    const attackers = typeMap(
      a,
      b,
      makeType('fire', {}, { withNames: false }),
      makeType('ice', {}),
    );

    const matchups = computeTypeMatchups(['a', 'b'], attackers);

    expect(matchups.weaknesses).toEqual([
      { multiplier: 4, types: [{ id: 'fire', name: { ja: 'fire', en: 'fire' } }] },
      { multiplier: 2, types: [{ id: 'ice', name: { ja: 'ice-ja', en: 'ice-en' } }] },
    ]);
    expect(matchups.resistances).toEqual([]);
    expect(matchups.immunities).toEqual([]);
  });
});

function flavor(text: string, language: string, version = 'v'): PokeApiFlavorTextEntry {
  return {
    flavor_text: text,
    language: { name: language, url: '' },
    version: { name: version, url: '' },
  };
}

function genusOf(genus: string, language: string): PokeApiGenus {
  return { genus, language: { name: language, url: '' } };
}

describe('formatFlavorText', () => {
  it('collapses newlines, form feeds and whitespace runs to single spaces and trims', () => {
    expect(formatFlavorText('A strange\nseed was\fplanted')).toBe('A strange seed was planted');
    expect(formatFlavorText('  leading\n\n and\f\f trailing  ')).toBe('leading and trailing');
    expect(formatFlavorText('うまれた\nときから\fせなか')).toBe('うまれた ときから せなか');
  });
});

describe('buildLocalizedFlavorText', () => {
  it('selects ja-Hrkt/ja for ja and en for en, formatting the chosen text', () => {
    const entries = [
      flavor('Old\nEnglish', 'en', 'red'),
      flavor('New\fEnglish', 'en', 'shield'),
      flavor('にほんご\nのせつめい', 'ja-Hrkt', 'shield'),
    ];

    expect(buildLocalizedFlavorText(entries)).toEqual({
      ja: 'にほんご のせつめい',
      en: 'New English',
    });
  });

  it('falls back ja to the en entry when no ja text exists', () => {
    const entries = [flavor('Only\nEnglish', 'en')];

    expect(buildLocalizedFlavorText(entries)).toEqual({
      ja: 'Only English',
      en: 'Only English',
    });
  });

  it('uses ja-Hrkt over ja when both are present', () => {
    const entries = [flavor('hrkt', 'ja-Hrkt'), flavor('kanji', 'ja'), flavor('english', 'en')];

    expect(buildLocalizedFlavorText(entries).ja).toBe('hrkt');
  });

  it('tolerates undefined or empty entries and uses the fallback', () => {
    expect(buildLocalizedFlavorText(undefined)).toEqual({ ja: '', en: '' });
    expect(buildLocalizedFlavorText([], 'n/a')).toEqual({ ja: 'n/a', en: 'n/a' });
  });
});

describe('buildLocalizedGenus', () => {
  it('selects ja-Hrkt/ja for ja and en for en', () => {
    const genera = [genusOf('ねずみポケモン', 'ja-Hrkt'), genusOf('Mouse Pokémon', 'en')];

    expect(buildLocalizedGenus(genera)).toEqual({
      ja: 'ねずみポケモン',
      en: 'Mouse Pokémon',
    });
  });

  it('falls back ja to en when no ja genus exists', () => {
    const genera = [genusOf('Mouse Pokémon', 'en')];

    expect(buildLocalizedGenus(genera)).toEqual({
      ja: 'Mouse Pokémon',
      en: 'Mouse Pokémon',
    });
  });

  it('tolerates undefined or empty genera and uses the fallback', () => {
    expect(buildLocalizedGenus(undefined)).toEqual({ ja: '', en: '' });
    expect(buildLocalizedGenus([], 'unknown')).toEqual({ ja: 'unknown', en: 'unknown' });
  });
});
