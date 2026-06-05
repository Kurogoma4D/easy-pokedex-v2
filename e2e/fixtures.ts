import type { Page, Route } from '@playwright/test';

/**
 * E2E 用の BFF レスポンス・スタブ。
 *
 * フロントが叩く BFF DTO（`apps/web/src/app/features/**` のモデル）と同じ形を最小限で再現する。
 * 実際の上流値ではなく、相性パネル・検索結果の描画を確定的に検証できる代表値を持つ。
 */

interface LocalizedName {
  readonly ja: string;
  readonly en: string;
}

const sprite = (id: number): string =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

/** 鳴き声音源 URL。フロントは PokeAPI 由来 URL を直接 Audio で参照する（BFF はプロキシしない）。 */
const cry = (id: number): string =>
  `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;

const type = (id: string, ja: string, en: string): { id: string; name: LocalizedName } => ({
  id,
  name: { ja, en },
});

/**
 * リザードン（ほのお／ひこう）の詳細スタブ。複合タイプの被ダメージ相性を掛け合わせた結果、
 * ×4（いわ）・×0.5/×0.25（耐性）・×0（じめん, 飛行で無効）が出るため、倍率ラベルとタイプチップの
 * ローカライズ両方を 1 体で検証できる。
 */
export const CHARIZARD_DETAIL = {
  id: 6,
  name: { ja: 'リザードン', en: 'Charizard' },
  imageUrl: sprite(6),
  height: 17,
  weight: 905,
  types: [type('fire', 'ほのお', 'Fire'), type('flying', 'ひこう', 'Flying')],
  stats: [
    { id: 'hp', base: 78 },
    { id: 'attack', base: 84 },
    { id: 'defense', base: 78 },
    { id: 'special-attack', base: 109 },
    { id: 'special-defense', base: 85 },
    { id: 'speed', base: 100 },
  ],
  abilities: [
    { id: 'blaze', name: { ja: 'もうか', en: 'Blaze' }, isHidden: false },
    { id: 'solar-power', name: { ja: 'サンパワー', en: 'Solar Power' }, isHidden: true },
  ],
  evolutionChain: {
    id: 4,
    name: { ja: 'ヒトカゲ', en: 'Charmander' },
    imageUrl: sprite(4),
    evolvesTo: [
      {
        id: 5,
        name: { ja: 'リザード', en: 'Charmeleon' },
        imageUrl: sprite(5),
        evolvesTo: [
          {
            id: 6,
            name: { ja: 'リザードン', en: 'Charizard' },
            imageUrl: sprite(6),
            evolvesTo: [],
          },
        ],
      },
    ],
  },
  typeMatchups: {
    weaknesses: [
      { multiplier: 4, types: [type('rock', 'いわ', 'Rock')] },
      {
        multiplier: 2,
        types: [type('water', 'みず', 'Water'), type('electric', 'でんき', 'Electric')],
      },
    ],
    resistances: [
      {
        multiplier: 0.25,
        types: [type('grass', 'くさ', 'Grass'), type('bug', 'むし', 'Bug')],
      },
      {
        multiplier: 0.5,
        types: [type('fighting', 'かくとう', 'Fighting'), type('fire', 'ほのお', 'Fire')],
      },
    ],
    immunities: [{ multiplier: 0, types: [type('ground', 'じめん', 'Ground')] }],
  },
  flavorText: {
    ja: 'ひこうしながら きえん を はく。からだじゅうが もえているように みえる。',
    en: 'It breathes fire that is hot enough to melt boulders.',
  },
  genus: { ja: 'かえんポケモン', en: 'Flame Pokémon' },
  generation: 'generation-i',
  isLegendary: false,
  isMythical: false,
  cryUrl: cry(6),
} as const;

/**
 * ミュウ（伝説かつ幻）の詳細スタブ。`isLegendary` と `isMythical` を両方立て、
 * 伝説/幻バッジが両方描画されることを E2E で検証するために用いる。
 */
export const MEW_DETAIL = {
  id: 151,
  name: { ja: 'ミュウ', en: 'Mew' },
  imageUrl: sprite(151),
  height: 4,
  weight: 40,
  types: [type('psychic', 'エスパー', 'Psychic')],
  stats: [
    { id: 'hp', base: 100 },
    { id: 'attack', base: 100 },
    { id: 'defense', base: 100 },
    { id: 'special-attack', base: 100 },
    { id: 'special-defense', base: 100 },
    { id: 'speed', base: 100 },
  ],
  abilities: [{ id: 'synchronize', name: { ja: 'シンクロ', en: 'Synchronize' }, isHidden: false }],
  evolutionChain: {
    id: 151,
    name: { ja: 'ミュウ', en: 'Mew' },
    imageUrl: sprite(151),
    evolvesTo: [],
  },
  typeMatchups: {
    weaknesses: [],
    resistances: [],
    immunities: [],
  },
  flavorText: {
    ja: 'いでんしには すべての ポケモンの ようそが ふくまれていると いわれている。',
    en: 'Its DNA is said to contain the genetic codes of all Pokémon.',
  },
  genus: { ja: 'しんしゅポケモン', en: 'New Species Pokémon' },
  generation: 'generation-i',
  isLegendary: true,
  isMythical: true,
  cryUrl: cry(151),
} as const;

/**
 * 鳴き声 URL が無いポケモンの詳細スタブ。再生ボタンが無効化され、音源欠落時のフォールバックを
 * E2E で検証するために用いる（リザードンの形を流用し cryUrl だけ null にする）。
 */
export const NO_CRY_DETAIL = {
  ...CHARIZARD_DETAIL,
  id: 7,
  name: { ja: 'ゼニガメ', en: 'Squirtle' },
  cryUrl: null,
} as const;

/** 名前検索（`?name=...`）のスタブ結果。リザードンと近縁の数体だけを返す。 */
export const SEARCH_RESULTS = {
  count: 1,
  offset: 0,
  limit: 24,
  nextOffset: null,
  results: [
    {
      id: 6,
      imageUrl: sprite(6),
      name: { ja: 'リザードン', en: 'Charizard' },
      types: ['fire', 'flying'],
    },
  ],
} as const;

/** ブラウズ（`/pokemon/list`）のスタブ結果。検索前の初期一覧表示に使う。 */
export const LIST_RESULTS = {
  count: 3,
  offset: 0,
  limit: 24,
  nextOffset: null,
  results: [
    {
      id: 1,
      imageUrl: sprite(1),
      name: { ja: 'フシギダネ', en: 'Bulbasaur' },
      types: ['grass', 'poison'],
    },
    {
      id: 4,
      imageUrl: sprite(4),
      name: { ja: 'ヒトカゲ', en: 'Charmander' },
      types: ['fire'],
    },
    {
      id: 6,
      imageUrl: sprite(6),
      name: { ja: 'リザードン', en: 'Charizard' },
      types: ['fire', 'flying'],
    },
  ],
} as const;

const fulfillJson = (route: Route, body: unknown): Promise<void> =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;
const HIRAGANA_TO_KATAKANA_OFFSET = 0x60;

/**
 * BFF（`apps/bff/src/pokeapi/search.ts` の `normalize`）と同じ正規化をブラウザ層で再現する。
 * NFKC で全角英数字・半角カタカナを畳み込み、ひらがなを +0x60 のシフトでカタカナへ写し、
 * trim/lowercase する。これにより検索スタブが本物の BFF と同じ判定で結果を返し、
 * かな正規化を E2E が実際に通る（単に固定値を返すだけにならない）。
 */
function normalizeQuery(value: string): string {
  const folded = value.trim().toLowerCase().normalize('NFKC');
  let result = '';
  for (const char of folded) {
    const code = char.codePointAt(0)!;
    if (code >= HIRAGANA_START && code <= HIRAGANA_END) {
      result += String.fromCodePoint(code + HIRAGANA_TO_KATAKANA_OFFSET);
    } else {
      result += char;
    }
  }
  return result;
}

/** 検索結果候補の正規化済み名前と、正規化クエリが部分一致するかを判定する。 */
function matchesSearchCandidate(query: string): boolean {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length === 0) {
    return false;
  }
  return SEARCH_RESULTS.results.some((r) =>
    [r.name.ja, r.name.en, String(r.id)].some((haystack) =>
      normalizeQuery(haystack).includes(normalizedQuery),
    ),
  );
}

const EMPTY_SEARCH_RESULTS = {
  count: 0,
  offset: 0,
  limit: 24,
  nextOffset: null,
  results: [],
} as const;

/**
 * BFF（`/api/pokemon/**`）への通信をブラウザ層でスタブする。スプライト画像は外部 CDN を叩かないよう
 * 透明 1px の PNG で打ち返し、鳴き声音源も最小の OGG で打ち返して E2E をネットワーク非依存にする。
 * 検索は `name` パラメータを BFF と同じ正規化に通し、候補名に部分一致したときだけカタカナ名の結果を返す。
 */
export async function stubBff(page: Page): Promise<void> {
  await page.route('**/api/pokemon/list**', (route) => fulfillJson(route, LIST_RESULTS));
  await page.route('**/api/pokemon/search**', (route) => {
    const name = new URL(route.request().url()).searchParams.get('name') ?? '';
    return fulfillJson(route, matchesSearchCandidate(name) ? SEARCH_RESULTS : EMPTY_SEARCH_RESULTS);
  });
  await page.route('**/api/pokemon/6', (route) => fulfillJson(route, CHARIZARD_DETAIL));
  await page.route('**/api/pokemon/7', (route) => fulfillJson(route, NO_CRY_DETAIL));
  await page.route('**/api/pokemon/151', (route) => fulfillJson(route, MEW_DETAIL));
  // 詳細はお気に入りページのカード描画用。番号 1/4 のスタブを少数の id で返す。
  await page.route('**/api/pokemon/1', (route) =>
    fulfillJson(route, { ...CHARIZARD_DETAIL, id: 1, name: { ja: 'フシギダネ', en: 'Bulbasaur' } }),
  );
  await page.route('**/api/pokemon/4', (route) =>
    fulfillJson(route, { ...CHARIZARD_DETAIL, id: 4, name: { ja: 'ヒトカゲ', en: 'Charmander' } }),
  );

  await page.route('https://raw.githubusercontent.com/**', (route) => {
    const url = route.request().url();
    // 鳴き声音源（.ogg）は最小の OGG ヘッダで、画像は透明 1px PNG で打ち返す。
    if (url.endsWith('.ogg')) {
      return route.fulfill({
        status: 200,
        contentType: 'audio/ogg',
        body: Buffer.from('OggS', 'ascii'),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Y2wAAAAAElFTkSuQmCC',
        'base64',
      ),
    });
  });

  await stubAuth(page);
}

/**
 * 認証・お気に入り API（`/api/auth/**`, `/api/favorites/**`）をブラウザ層でスタブする。
 * セッションとお気に入りをページ内の可変状態として保持し、未ログイン時の 401、ログイン後の
 * トグル・一覧取得を本物の BFF と同じ挙動で再現する（Cookie のやり取りはしないため状態で代用）。
 * `stubBff` から呼ばれ、既定では未ログイン状態でセットアップされる。
 */
export async function stubAuth(page: Page): Promise<void> {
  const state = { loggedIn: false, favorites: [] as number[] };

  await page.route('**/api/auth/me', (route) =>
    state.loggedIn
      ? fulfillJson(route, { user: { id: 1, email: 'trainer@example.com' } })
      : route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );

  const authenticate = (route: Route): Promise<void> => {
    state.loggedIn = true;
    return fulfillJson(route, { user: { id: 1, email: 'trainer@example.com' } });
  };
  await page.route('**/api/auth/login', authenticate);
  await page.route('**/api/auth/register', authenticate);
  await page.route('**/api/auth/logout', (route) => {
    state.loggedIn = false;
    state.favorites = [];
    return route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/api/favorites', (route) => {
    if (!state.loggedIn) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    }
    return fulfillJson(route, { pokemonIds: state.favorites });
  });

  await page.route(/\/api\/favorites\/(\d+)$/, (route) => {
    if (!state.loggedIn) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    }
    const id = Number(/\/api\/favorites\/(\d+)$/.exec(route.request().url())![1]);
    const method = route.request().method();
    if (method === 'PUT') {
      if (!state.favorites.includes(id)) {
        state.favorites = [id, ...state.favorites];
      }
      return fulfillJson(route, { pokemonId: id, favorite: true });
    }
    state.favorites = state.favorites.filter((value) => value !== id);
    return fulfillJson(route, { pokemonId: id, favorite: false });
  });
}
