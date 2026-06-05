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

/**
 * BFF（`/api/pokemon/**`）への通信をブラウザ層でスタブする。スプライト画像は外部 CDN を叩かないよう
 * 透明 1px の PNG で打ち返し、E2E をネットワーク非依存にする。
 */
export async function stubBff(page: Page): Promise<void> {
  await page.route('**/api/pokemon/list**', (route) => fulfillJson(route, LIST_RESULTS));
  await page.route('**/api/pokemon/search**', (route) => fulfillJson(route, SEARCH_RESULTS));
  await page.route('**/api/pokemon/6', (route) => fulfillJson(route, CHARIZARD_DETAIL));

  await page.route('https://raw.githubusercontent.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Y2wAAAAAElFTkSuQmCC',
        'base64',
      ),
    }),
  );
}
