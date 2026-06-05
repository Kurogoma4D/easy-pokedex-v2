# PR 戦略比較実験

1 つの issue を PR にする際の 2 つの方針について、生産性（速度）と品質を比較する実験の仕様。

## 比較する方針

- 方針A（反復セルフレビュー）`/pr-strategy-iterate <issue>`
  - 1 issue を 1 本の PR に実装し、セルフレビューと修正を指摘がなくなる（LGTM）まで繰り返す。
- 方針B（分割 PR）`/pr-strategy-split <issue>`
  - 1 issue を 2〜5 個の細かい PR に分割し、各 PR でセルフレビューと修正を 1 ターンのみ行う。

両方針とも PR はマージせずオープンのまま残す。

## 計測する指標

- 速度: 作業開始からセルフレビュー完了（PR がレビュー可能な最終状態になる）までの所要秒数。
  - 終了点は `READY_AT`（方針A は反復完了時、方針B は全 PR の 1 ターン修正完了時）。
  - マージまでのリードタイムは含めない。
- 品質: 最終差分を `/pr-quality-judge <issue> <pr...>` で改めて採点した weighted_total（0〜100）。
  - 実装・レビューの過程は見ず、完成差分のみを同一ルーブリック・同一重みで評価する。

## 公平な比較の前提

- 同一 issue に対して方針A・方針B をそれぞれ別実行で適用する（同じ main 断面から開始する）。
- どちらも実装は `github-issue-implementer`、レビューは `code-reviewer` を使う。差は反復回数と分割粒度のみ。
- 品質は両方針の最終差分を同じ基準で採点する。

## 成果物の配置

```
docs/experiments/pr-strategy/
  README.md                         # 本仕様
  <run-id>/
    metrics.json                    # 速度・反復/分割回数（実装スキルが出力）
    quality.json                    # 品質スコア（判定スキルが出力）
```

- `run-id` 形式: `issue-<番号>-<approach>-<UTC タイムスタンプ>`（approach は `iterate` / `split`）。

## metrics.json スキーマ

```json
{
  "run_id": "string",
  "issue": 0,
  "approach": "iterate | split",
  "started_at": "ISO8601 UTC",
  "pr_first_opened_at": "ISO8601 UTC",
  "ready_at": "ISO8601 UTC",
  "elapsed_seconds": 0,
  "prs": [
    { "number": 0, "url": "string", "opened_at": "ISO8601 UTC", "part": 1, "review_rounds": 0, "findings_deferred": 0 }
  ],
  "split_count": 1,
  "review_rounds": 0,
  "findings_deferred": 0,
  "notes": "string"
}
```

- 方針A: `split_count` は 1、`review_rounds` は LGTM までの反復回数。`prs` は 1 要素。
- 方針B: `split_count` は分割数、各 PR の `review_rounds` は 1。`prs` は分割数ぶん。

## quality.json スキーマ

```json
{
  "issue": 0,
  "approach": "iterate | split | unknown",
  "prs": [0],
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

`weighted_total = Σ(scores[i] / 5 * weight[i])`。

## 実行手順

同一 issue（例 #42）で両方針を回し、それぞれの最終差分を採点する。

```
/pr-strategy-iterate 42      # 方針A 実行 → metrics.json
/pr-quality-judge 42 <PR>    # 方針A の最終差分を採点 → quality.json

/pr-strategy-split 42        # 方針B 実行 → metrics.json
/pr-quality-judge 42 <PR1>,<PR2>,...   # 方針B の最終差分を採点 → quality.json
```

両方針の `elapsed_seconds`（速度）と `weighted_total`（品質）を並べて、生産性の優劣を判断する。
複数の issue で繰り返すと、方針差がブレでなく傾向として読める。
