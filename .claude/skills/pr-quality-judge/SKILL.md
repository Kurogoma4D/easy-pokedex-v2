---
name: pr-quality-judge
description: |
  PR 戦略比較実験の「品質」を測るスキル。1 つの issue に対する最終的な差分（方針A は 1 本の PR、
  方針B は複数 PR の和集合）を改めて読み、issue 要件への適合度をルーブリックで採点する。
  実装フローからは独立した第三者視点で評価し、quality.json に重み付き総合スコアと指摘を記録する。
  `/pr-quality-judge <issue-number> <pr-number>[,<pr-number>...]` で起動する。
allowed-tools:
  - Bash
  - Write
---

# PR Quality Judge — 最終差分の品質判定

PR 戦略比較実験（方針A `/pr-strategy-iterate` vs 方針B `/pr-strategy-split`）の **品質側の計測**を担う。
ある issue に対する **最終的な差分**を改めて読み、issue 要件への適合度をルーブリックで採点する。
実装・レビューの過程は見ず、**完成した差分そのもの**だけを第三者視点で評価する。
計測の定義と保存形式は [experiments ガイド](../../../docs/experiments/pr-strategy/README.md) に従う。

## 入力

- 第 1 引数: issue 番号。
- 第 2 引数: 評価対象の PR 番号。方針A は 1 個、方針B はカンマ区切りで複数（例 `101,102,103`）。
- 例: `/pr-quality-judge 42 101` / `/pr-quality-judge 42 101,102,103`

## ワークフロー

### Step 1 — 要件と差分を収集

```bash
gh issue view <issue-number> --repo Kurogoma4D/easy-pokedex-v2 --json number,title,body,labels
```

各 PR について差分と説明を取得し、**全 PR の差分を 1 つの最終差分として束ねて**評価対象にする。

```bash
gh pr diff <pr-number> --repo Kurogoma4D/easy-pokedex-v2
gh pr view <pr-number> --repo Kurogoma4D/easy-pokedex-v2 --json number,title,body,headRefName,additions,deletions
```

- 方針B で PR が積み重ね（base が前段ブランチ）になっている場合、`gh pr diff` の重複を避けるため
  各 PR の差分内容を確認し、最終的なコードベースの変更全体を把握する。重複が疑わしいときは
  各 PR の `headRefName` を base からまとめて diff し、和集合を再構成する。

### Step 2 — ルーブリック採点（各 0〜5）

実装の経緯やセルフレビュー履歴は考慮しない。完成差分が issue 要件をどれだけ満たすかだけを見る。
各観点を 0〜5 で採点する（0 = 全く満たさない / 5 = 完全かつ的確）。

- `correctness` — issue 要件・受け入れ条件を正しく満たすか。バグ・未処理パス・競合がないか。
- `design` — アーキテクチャが妥当で保守しやすいか。責務分離・モジュール境界が適切か。
- `tests` — 新規・変更箇所に Vitest テストがあり、ハッピーパスだけでなくエッジケースも覆うか。
- `idioms` — Angular 21 イディオム（standalone / signal / `httpResource` / `inject` / 新制御フロー `@if`・`@for` with `track` / zoneless）に沿うか。NgModules・`*ngIf`/`*ngFor`・Zone 依存・Karma/Jasmine がないか。
- `boundary_i18n` — PokeAPI アクセスが BFF 経由に限定され型が前後で整合するか。ユーザー向け文字列が ja/en で i18n 化され固有名詞がロケール解決されるか。
- `maintainability` — 命名・可読性・重複の少なさ・`any` 不使用・strict 整合・デバッグ文や過度な lint 抑制がないか。

### Step 3 — 重み付き総合スコア

100 点満点に正規化する。重みは以下。

| 観点 | 重み |
|---|---|
| correctness | 30 |
| design | 20 |
| tests | 20 |
| idioms | 12 |
| boundary_i18n | 10 |
| maintainability | 8 |

`weighted_total = Σ(score_i / 5 * weight_i)`（小数第 1 位まで）。

### Step 4 — quality.json を出力

- 対象差分が単一実験 run のものなら、その run ディレクトリ `docs/experiments/pr-strategy/<run-id>/quality.json` に保存する。
- run-id が不明な場合は `docs/experiments/pr-strategy/quality-issue-<issue>-<approach>-<タイムスタンプ>/quality.json` に保存する（タイムスタンプは `date -u +%Y%m%dT%H%M%SZ`）。
- スキーマは [experiments ガイド](../../../docs/experiments/pr-strategy/README.md) の quality.json に従う。

```json
{
  "issue": <issue-number>,
  "approach": "iterate" | "split" | "unknown",
  "prs": [<pr番号...>],
  "total_additions": <加算行合計>,
  "total_deletions": <削除行合計>,
  "scores": {
    "correctness": 0-5,
    "design": 0-5,
    "tests": 0-5,
    "idioms": 0-5,
    "boundary_i18n": 0-5,
    "maintainability": 0-5
  },
  "weighted_total": 0-100,
  "findings": [
    { "severity": "high|medium|low", "location": "file:line", "note": "..." }
  ],
  "verdict": "<総括 1〜3 文>"
}
```

### Step 5 — 報告

- 観点別スコアと weighted_total を表で示す。
- 主要な指摘（high / medium）を箇条書きで挙げる。
- quality.json のパスを示す。
- 同一 issue で方針A・方針B 双方の quality.json が揃っていれば、weighted_total を並べて比較する。

## ルール

- 評価は完成差分のみに基づく。実装・レビューの過程やコミット履歴は採点根拠にしない。
- 同一 issue・同一最終状態であれば、方針に依らず同じ基準・同じ重みで採点する（公平性のため）。
- スコアには必ず差分中の具体的な根拠（file:line）を結び付ける。
- 採点を甘くしない。要件の取りこぼし・テスト不足・境界違反は明確に減点する。
- 差分を取得できない PR があれば、その旨を notes / verdict に明記し、欠落を踏まえて採点する。
