# PR 戦略比較実験

1 つの issue を PR にする際の 2 つの方針について、生産性（速度）と品質を比較する実験の仕様。

## 比較する方針

- 方針A（反復セルフレビュー）`/pr-strategy-iterate <issue>`
  - 1 issue を 1 本の PR に実装し、セルフレビューと修正を指摘がなくなる（LGTM）まで繰り返す。
- 方針B（分割 PR）`/pr-strategy-split <issue>`
  - 1 issue を 2〜5 個の細かい PR に分割し、各 PR でセルフレビューと修正を 1 ターンのみ行う。

両方針とも PR はマージせずオープンのまま残す。

## 中核原則

### 1. 文脈隔離（コンテキストをフォークしない）

実装・レビュー・品質評価はすべて、独立した文脈の Subagent（Task/Agent ツール）に依頼する。Subagent へ渡すプロンプトは、その時点で取得した**正準ソースのみ**から構成する。

- 実装 Subagent: issue 本文（`gh issue view`）と当該パートのスコープのみ。
- レビュー Subagent: 対象 PR の diff のみ（`gh pr diff`）。
- 修正 Subagent: その PR に投稿されたレビュー指摘のみ（`gh pr view --json reviews`）。
- 品質評価 Subagent: issue 本文と最終差分（と PR の行動記録）のみ。

オーケストレーター（スキル実行者）は、別 issue・別ラン・過去の知見・自分が気づいた改善点などを、いかなる Subagent プロンプトにも混入させてはならない。同一 issue を A→B の順で回す場合でも、A のレビュー指摘を B の実装プロンプトに持ち込むことは禁止（過去ランで実際に起きた交絡を防ぐ）。

### 2. PR に行動記録を残し、評価は記録から集計する

速度・レビュー経過は、オーケストレーターの手元時計ではなく **PR 上の行動記録（runlog）** に残す。最終評価はその記録を辿って集計する。

runlog は GitHub の不変タイムスタンプ（コメント `createdAt` / レビュー `submittedAt`）をアンカーにする。

- 各マイルストーンで PR にコメントを投稿する（`gh pr comment`）。本文は以下の形式。

  ````
  <!-- pr-runlog:EVENT -->
  ```json
  {"event":"EVENT","approach":"iterate|split","issue":N,"run_id":"...","part":i,"round":k,"verdict":"LGTM|CHANGES_REQUESTED","findings":n,"self_reported_started_at":"ISO"}
  ```
  ````

- レビュー結果は `gh pr review <pr> --comment --body ...`（自分の PR には approve/request-changes 不可のため comment 型）で投稿する。本文冒頭に `RUNLOG-REVIEW round=<k> verdict=<LGTM|CHANGES_REQUESTED> findings=<n>` を書く。レビューの `submittedAt` が当該ラウンドの不変タイムスタンプ。

- イベント種別: `work_started`（PR 生成直後・`self_reported_started_at` を含む）/ `fix_applied`（round k の修正 push 後）/ `ready`（方針A は反復完了時、方針B はその PR の 1 ターン完了時）。

#### 記録からの集計

- `pr_opened_at` = PR の GitHub `createdAt`。
- `ready_at` = `ready` runlog コメントの `createdAt`。
- `review_rounds` = その PR に投稿された review（`RUNLOG-REVIEW`）の件数。
- 速度（PR アンカー）= 全 PR の最早 `createdAt` 〜 最終 `ready` コメントの秒数。これを主指標とする。
- `started_at`（作業開始）は PR 生成前で GitHub に残らないため、`work_started` の payload に自己申告値として残すのみ。補助指標。

## 公平な比較の前提

- 同一 issue に対して方針A・方針B をそれぞれ別実行で適用する（同じ main 断面から開始する）。
- どちらも実装は独立 Subagent（github-issue-implementer）、レビューは独立 Subagent（code-reviewer）。差は反復回数と分割粒度のみ。
- 品質は両方針の最終差分を、独立した評価 Subagent が同一ルーブリック・同一重みで採点する。
- A→B 順の文脈漏れを避けるため、各ランの Subagent プロンプトは正準ソースのみから組む（中核原則 1）。

## 成果物の配置

```
docs/experiments/pr-strategy/
  README.md                         # 本仕様
  <run-id>/
    metrics.json                    # 速度・反復/分割回数（PR 記録から集計）
    quality.json                    # 品質スコア（独立評価 Subagent が採点）
```

- `run-id` 形式: `issue-<番号>-<approach>-<UTC タイムスタンプ>`（approach は `iterate` / `split`）。

## metrics.json スキーマ

```json
{
  "run_id": "string",
  "issue": 0,
  "approach": "iterate | split",
  "started_at_self_reported": "ISO8601 UTC",
  "pr_opened_at": "ISO8601 UTC (PR createdAt)",
  "ready_at": "ISO8601 UTC (ready runlog コメント createdAt)",
  "elapsed_seconds": 0,
  "elapsed_source": "pr_records",
  "prs": [
    { "number": 0, "url": "string", "opened_at": "ISO8601 UTC", "part": 1, "review_rounds": 0, "findings_deferred": 0 }
  ],
  "split_count": 1,
  "review_rounds": 0,
  "findings_deferred": 0,
  "notes": "string"
}
```

- `elapsed_seconds` は PR 記録由来（最早 `pr_opened_at` 〜 最終 `ready_at`）。
- 方針A: `split_count` は 1、`review_rounds` は LGTM までの反復回数。`prs` は 1 要素。
- 方針B: `split_count` は分割数、各 PR の `review_rounds` は 1。`prs` は分割数ぶん。

## quality.json スキーマ

```json
{
  "issue": 0,
  "approach": "iterate | split | unknown",
  "prs": [0],
  "scored_by": "isolated-subagent",
  "total_additions": 0,
  "total_deletions": 0,
  "scores": {
    "correctness": 0,
    "design": 0,
    "tests": 0,
    "idioms": 0,
    "boundary_i18n": 0,
    "maintainability": 0
  },
  "weighted_total": 0,
  "findings": [{ "severity": "high|medium|low", "location": "file:line", "note": "string" }],
  "verdict": "string"
}
```

採点の重み（合計 100）

| 観点 | 重み |
|---|---|
| correctness | 30 |
| design | 20 |
| tests | 20 |
| idioms | 12 |
| boundary_i18n | 10 |
| maintainability | 8 |

`weighted_total = Σ(scores[i] / 5 * weight[i])`。採点は独立 Subagent が行い、オーケストレーターは返却 JSON をそのまま記録する（自分では採点しない）。

## 実行手順

同一 issue（例 #42）で両方針を回し、それぞれの最終差分を採点する。

```
/pr-strategy-iterate 42      # 方針A 実行 → PR に runlog → metrics.json(記録集計)
/pr-quality-judge 42 <PR>    # 独立 Subagent が採点 → quality.json

/pr-strategy-split 42        # 方針B 実行 → 各 PR に runlog → metrics.json
/pr-quality-judge 42 <PR1>,<PR2>,...   # 独立 Subagent が採点 → quality.json
```

両方針の `elapsed_seconds`（速度）と `weighted_total`（品質）を並べて、生産性の優劣を判断する。
複数の issue で繰り返すと、方針差がブレでなく傾向として読める。
