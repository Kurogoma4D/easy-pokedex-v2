# easy-pokedex-v2 — Specification

> Status: Draft · Last updated: 2026-06-03

## 1. Overview

PokeAPI を BFF（Backend for Frontend）経由で取得し、ポケモンを一覧・検索・詳細表示できる
Web アプリ。フロントエンドは Angular、BFF は Hono で実装する。固有名詞（ポケモン名・タイプ名など）は
PokeAPI が提供する多言語データを活用し、日本語と英語で表示する。対象は図鑑を気軽に閲覧したい
ポケモンファン全般。

## 2. Goals & Success Criteria

- ポケモン一覧を無限スクロールで快適に閲覧できる。
- 名前・タイプ・世代で目的のポケモンを絞り込める。
- 各ポケモンの詳細（ステータス、タイプ、特性、進化、図鑑番号）を確認できる。
- 日本語・英語の言語切り替えがアプリ全体（UI と固有名詞）で機能する。
- PokeAPI への直接アクセスは行わず、BFF が仲介・整形する。

## 3. Scope

- ポケモン一覧表示（グリッド／リスト）と無限スクロール。
- 検索・フィルタ（名前検索、タイプ・世代での絞り込み）。
- 詳細ページ（ステータス、タイプ、特性、進化、図鑑番号など）。
- 多言語対応（日本語・英語）。UI 文言と PokeAPI 由来の固有名詞の両方。
- Hono BFF による PokeAPI の取得・整形・キャッシュ。

## 4. Out of Scope

- お気に入り登録機能（今回は実装しない）。
- ユーザー認証・アカウント機能。
- ポケモン同士の比較・対戦シミュレーション。
- 編集・投稿などの書き込み系機能。

## 5. Functional Requirements

### FR-1: ポケモン一覧・無限スクロール
- 一覧をグリッド／リストで表示し、スクロール到達時に次ページを追加読み込みする。
- 各カードに図鑑番号、画像（スプライト）、名前（選択言語）、タイプを表示する。
- データは BFF のページネーション API から取得する。

### FR-2: 検索・フィルタ
- 名前（部分一致）で検索できる。日本語・英語どちらの名前でも検索可能とする。
- タイプ（複数選択可）および世代で絞り込める。
- フィルタ条件の組み合わせに対応し、結果を一覧に反映する。

### FR-3: 詳細ページ
- 図鑑番号・名前・画像・タイプ・ステータス（HP/攻撃/防御など）・特性・進化チェーンを表示する。
- 選択中の言語で固有名詞を表示する。
- BFF が複数の PokeAPI エンドポイントを集約して 1 レスポンスで返す。

### FR-4: 多言語対応（日本語・英語）
- UI 全体で言語切り替えを提供する（Angular の i18n またはランタイム切替）。
- ポケモン名・タイプ名・特性名などの固有名詞は PokeAPI の多言語データから選択言語の表記を取得する。
- 選択言語は永続化（localStorage 等）し、再訪時に復元する。

### FR-5: BFF（Hono）
- Angular からのリクエストを受け、PokeAPI へプロキシ・集約・整形して返す。
- 一覧・検索・詳細それぞれに最適化したエンドポイントを提供する。
- 上流（PokeAPI）レスポンスをキャッシュし、レート負荷とレイテンシを抑える。

## 6. Design & Branding

> To be implemented with the `frontend-design` skill via the issues created from this section.

### Direction
- Aesthetic & tone: レトロ・ゲーム風。初代携帯ゲーム機の図鑑をオマージュしたドット／ピクセル調で、
  懐かしさと遊び心を喚起する。
- Typography: ピクセル／ドット系のディスプレイフォントを見出しに、本文は可読性を確保した
  等幅寄りまたはレトロ調フォント。汎用的な Inter/Roboto には寄せない。
- Color & theme: モノクロ液晶風の緑がかったベースや、ポケモンタイプ色をアクセントに使う。
  ライト基調を主とし、レトロ機の質感（ベゼル／ドット）を演出。

### Branding assets to deliver
- DA-1: Design tokens — カラーパレット（液晶グリーン＋タイプ別アクセント）、ピクセルフォントの
  タイポスケール、8px グリッド系のスペーシング、ドット調に合う角丸／枠線トークン。
- DA-2: UI mockups — 一覧画面、検索／フィルタ UI、詳細画面のモックアップ。
- DA-3: Logo & icons — アプリロゴ、アプリアイコン、favicon、言語切替などの UI アイコン。
- DA-4: Brand guide — トーン＆マナー、ロゴ利用規定、カラールール（レトロ配色の使い方）。

## 7. Non-Functional Requirements

- パフォーマンス: 無限スクロールで滑らかに描画。BFF キャッシュで上流負荷とレイテンシを抑制。
- アクセシビリティ: キーボード操作・コントラスト確保。レトロ配色でも可読性を担保する。
- 国際化: 日本語・英語。文言は i18n リソースで管理し、固有名詞は API データを利用。
- 信頼性: PokeAPI 障害時はキャッシュ／エラーメッセージで穏当にフォールバック。

## 8. Supply-Chain Security

> 方針は「最小限」。lockfile コミットと frozen install を必須とし、CI ハードニングは後回し。

- Dependencies: `pnpm-lock.yaml` をコミットし、CI/インストールは frozen lockfile（`pnpm install --frozen-lockfile`）で行う。
- Install scripts & registries: 公式レジストリ（npm registry）のみを使用。postinstall スクリプトは原則不要、追加時にレビュー。
- Auditing: 最小限のため CI 常設は当面見送り。必要に応じて手動で `pnpm audit` を実行。
- CI hardening: 今回はスコープ外（SHA ピン留め・最小権限トークン・Dependabot は後続課題）。
- Trusted tooling: 既定の信頼済みツールのみ。新規 MCP サーバー等は導入時に都度確認。

## 9. Constraints

### Project metadata
- Repository: `Kurogoma4D/easy-pokedex-v2`
- Structure: pnpm ワークスペースのモノレポ。
  - `apps/web` — Angular フロントエンド
  - `apps/bff` — Hono BFF
  - ルートにワークスペース設定（`pnpm-workspace.yaml`）と共有設定

### Tech stack
- Language: TypeScript（フロント・BFF とも）
- Frontend: Angular 21（LTS）。signal-first / standalone components / zoneless 変更検知 / 新制御フロー（`@if` `@for` `@switch`）を前提とする。NgModules は使わない。
- Frontend の状態・データ取得: Signals 中心（`signal` / `computed` / `effect`、`httpResource`）。RxJS は必要な箇所に限定して使用。DI は `inject()` を基本とする。
- BFF: Hono（bff）
- データソース: PokeAPI（上流。直接アクセスは BFF 経由に限定）
- Package manager: pnpm（`packageManager` フィールドでバージョン固定）
- Version manager: 任意（`mise`/`asdf` 等。未指定）
- Lint / format / type check: ESLint + Prettier、`tsc` による型チェック。pnpm スクリプトから実行。
- Testing: Vitest（Angular 21 のデフォルト。Karma/Jasmine は使わない）
- Tooling (QA commands):
  - Install: `pnpm install --frozen-lockfile`
  - Lint: `pnpm lint`
  - Format: `pnpm format`
  - Type check / build: `pnpm build`
  - Test: `pnpm test`（Vitest）

### Other constraints
- データは PokeAPI に依存。直接アクセスは BFF 経由に限定する。
- 対応言語は日本語・英語の 2 言語。

## 10. Open Questions & Risks

- Angular の i18n 方式を実装時に確定する。言語をランタイムで切り替える要件のため、`@angular/localize` のビルド時 i18n（言語ごとに別ビルド）よりも、signal ベースのロケールサービス＋メッセージ辞書によるランタイム切替が有力。
- BFF のホスティング先（Node ランタイム／エッジ）とキャッシュ層（メモリ／外部）の選定。
- PokeAPI のレート制限・利用規約の確認と、キャッシュ TTL の決定。
- 検索を BFF 側で行うか、一覧データをクライアントで絞り込むかの方式選定。
