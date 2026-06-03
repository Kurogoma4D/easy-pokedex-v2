# easy-pokedex-v2

PokeAPI を BFF（Backend for Frontend）経由で取得し、ポケモンを一覧・検索・詳細表示できる
Web アプリ。フロントエンドは Angular、BFF は Hono で実装します。ポケモン名やタイプ名などの
固有名詞は PokeAPI が提供する多言語データを活用し、日本語・英語で表示します。

レトロ・ゲーム風（ドット／ピクセル調）のデザインで、図鑑を気軽に閲覧できることを目指します。

## 主な機能

- ポケモン一覧表示（グリッド／リスト）と無限スクロール
- 検索・フィルタ（名前検索、タイプ・世代での絞り込み。日本語・英語どちらの名前でも検索可能）
- 詳細ページ（図鑑番号、ステータス、タイプ、特性、進化チェーンなど）
- 多言語対応（日本語・英語）。UI 文言と PokeAPI 由来の固有名詞の両方を切り替え
- Hono BFF による PokeAPI の取得・整形・キャッシュ（フロントは BFF 経由でのみアクセス）

スコープ外: お気に入り登録、ユーザー認証、ポケモン同士の比較・対戦、書き込み系機能。

## 技術スタック

- 言語: TypeScript（strict）
- フロントエンド: Angular 21（LTS）— standalone components、signal-first、zoneless 変更検知、
  新制御フロー（`@if` / `@for` / `@switch`）、`inject()` による DI
- 状態・データ取得: Signals 中心（`signal` / `computed` / `effect`、`httpResource`）。
  RxJS は必要な箇所に限定
- BFF: Hono（Node.js）
- データソース: PokeAPI（上流）
- パッケージマネージャ: pnpm（`packageManager` で固定）
- Lint / Format / 型チェック: ESLint + Prettier、`tsc`
- テスト: Vitest

## リポジトリ構成

pnpm ワークスペースのモノレポです。

```
.
├── apps/
│   ├── web/   # Angular フロントエンド
│   └── bff/   # Hono BFF（PokeAPI のプロキシ・集約・キャッシュ）
└── pnpm-workspace.yaml
```

## セットアップと実行

> アプリ本体は GitHub Issue として分解し、順次実装していきます。下記コマンドは構成確定後の想定です。

```bash
# 依存インストール（lockfile を固定）
pnpm install --frozen-lockfile

# 開発サーバー（フロント / BFF）
pnpm --filter web dev
pnpm --filter bff dev

# 品質チェック
pnpm lint      # ESLint
pnpm format    # Prettier
pnpm build     # 型チェック / ビルド
pnpm test      # Vitest
```

## 仕様

詳細な要件は [`spec.md`](./spec.md) を参照してください。

## デザイン

トーン＆マナー、ロゴ利用規定、カラールール、タイポグラフィは [`docs/brand-guide.md`](./docs/brand-guide.md) にまとめています。色・フォント・余白のトークンは [`apps/web/src/styles/tokens.css`](./apps/web/src/styles/tokens.css) を単一ソースとします。

## ライセンス

MIT
