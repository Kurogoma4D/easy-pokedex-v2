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
- アカウント登録・ログイン（メール+パスワード、セッション Cookie 方式）
- ポケモンのお気に入り登録・解除と、ログインユーザー専用のお気に入り一覧

スコープ外: OAuth / ソーシャルログイン、確認メール・パスワードリセット、プロフィール編集、
ポケモン同士の比較・対戦。

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

```bash
# 依存インストール（lockfile を固定）
pnpm install --frozen-lockfile

# 環境変数を用意する（接続情報・ポート等）
cp .env.example .env

# Postgres を起動する（docker-compose）
docker compose up -d postgres

# マイグレーションを適用する（bff 起動時にも自動適用される）
pnpm --filter bff migrate

# 開発サーバー（フロント / BFF）
pnpm dev:web
pnpm dev:bff

# 品質チェック
pnpm lint      # ESLint
pnpm format    # Prettier
pnpm build     # 型チェック / ビルド
pnpm test      # Vitest
pnpm e2e       # Playwright（E2E）
```

### 認証・お気に入りの構成

- 永続化層は Postgres。`docker-compose.yml` で起動でき、接続情報は `.env`（雛形は `.env.example`）で設定する。
- bff は起動時にマイグレーションを適用してから受け付ける。手動適用は `pnpm --filter bff migrate`。
- 認証はメール+パスワード。パスワードは bcrypt でハッシュ化して保存し、認証成功時に HttpOnly の
  セッション Cookie を発行する。お気に入りはログインユーザーに紐づき、保護 API は未認証アクセスを拒否する。

## 仕様

詳細な要件は [`spec.md`](./spec.md) を参照してください。

## デザイン

トーン＆マナー、ロゴ利用規定、カラールール、タイポグラフィは [`docs/brand-guide.md`](./docs/brand-guide.md) にまとめています。色・フォント・余白のトークンは [`apps/web/src/styles/tokens.css`](./apps/web/src/styles/tokens.css) を単一ソースとします。

## ライセンス

MIT
