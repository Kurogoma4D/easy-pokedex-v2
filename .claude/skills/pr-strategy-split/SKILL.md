---
name: pr-strategy-split
description: |
  方針B（分割 PR）で 1 つの GitHub issue を、ある程度細かい単位の複数 PR に分割して実装する。
  分割した各 PR ごとに github-issue-implementer で実装し、code-reviewer による
  セルフレビューと修正を「1 ターンのみ」行う（再レビューはしない）。全 PR をオープンのまま残す。
  作業開始から全 PR のセルフレビュー完了までの所要時間と分割数を計測し metrics.json に記録する。
  `/pr-strategy-split <issue-number>` で起動する。
allowed-tools:
  - Bash
  - Task
  - Write
---

# PR Strategy B — 分割 PR・各 1 ターン

**easy-pokedex-v2**（`Kurogoma4D/easy-pokedex-v2`、Angular + Hono BFF の Pokédex アプリ）の
1 つの issue を、**ある程度細かい単位の複数 PR** に分割して実装する方針Bの実行スキル。

各 PR ごとにセルフレビューと修正を **1 ターンのみ** 行い（再レビューはしない）、全 PR をオープンのまま残す。
PR 戦略の比較実験（方針A vs 方針B）の片側を担う。計測の定義と保存形式は
[experiments ガイド](../../../docs/experiments/pr-strategy/README.md) に従う。

## 入力

- issue 番号を引数で受け取る（例 `/pr-strategy-split 42`）。
- 番号がない場合は最も古い open issue を対象にする。

```bash
gh issue list --repo Kurogoma4D/easy-pokedex-v2 --state open --limit 1 -S "sort:created-asc" --json number,title,labels
```

- open issue が無ければ「対象 issue なし」と報告して停止する。

## ワークフロー

### Step 0 — 計測開始と run-id 確定

```bash
RUN_TS=$(date -u +%Y%m%dT%H%M%SZ)
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "run started: $STARTED_AT"
```

- `run-id` は `issue-<番号>-split-<RUN_TS>` とする。
- 出力先 `docs/experiments/pr-strategy/<run-id>/` を作成する。

### Step 1 — issue を解決

```bash
gh issue view <number> --repo Kurogoma4D/easy-pokedex-v2 --json number,title,labels,body
```

- issue が open であることを確認する。closed なら続行可否をユーザーに確認する。
- `wontfix` / `on-hold` ラベルは対象外として報告し停止する。
- 依存 issue が未解決なら報告して停止する。

### Step 2 — 分割計画

- issue の要件を、レビュー可能な独立性の高い **2〜5 個の段階的なサブタスク**に分割する。
- 分割の指針
  - 各サブタスクは単体で意味が通り、品質チェック（build/test）が通る粒度にする。
  - 後段は前段のブランチを土台にする（依存順に積む）。`base-<i>` は前段の作業ブランチ。
  - BFF と frontend の境界、型定義、UI、テストなど自然な切れ目で割る。
- 分割計画（番号・概要・依存順）をユーザーに提示してから実装に入る。

### Step 3 — 各サブタスクを実装＋1 ターンのレビュー（順次）

サブタスク `i = 1..N` を依存順に処理する。各サブタスクで以下を行う。

1. 実装を **github-issue-implementer** に委譲する。

```
Task tool:
  subagent_type: github-issue-implementer
  prompt: |
    Implement PART <i>/<N> of issue #<number> for easy-pokedex-v2 (Kurogoma4D/easy-pokedex-v2).
    Scope of this part: <サブタスク i の説明>.
    Base branch: <i==1 なら main、それ以外は前段の作業ブランチ>. Check out and pull it before branching.
    Implement ONLY this part, run quality checks (install/lint/format/build/test), and open one focused PR
    whose body references issue #<number> (use "Part <i>/<N>", do not auto-close the issue except in the last part).
```

2. PR 番号 / URL を取得し、その PR のオープン時刻を記録する。

3. その PR を **code-reviewer** でレビューする（1 回だけ）。

```
Task tool:
  subagent_type: code-reviewer
  prompt: |
    Review PR #<pr-number> in the Kurogoma4D/easy-pokedex-v2 repository.
    Return a list of issues found, or "LGTM" if the code is acceptable.
```

4. 指摘があれば github-issue-implementer を再開して修正を **1 ターンだけ** 適用し push する。
   **再レビューはしない。** 残った／新たに生じた指摘は `findings_deferred` として記録する。
   LGTM ならそのまま次へ。

5. 次のサブタスクは、この PR の作業ブランチを base にして Step 3 を繰り返す。

### Step 4 — 計測終了と metrics 記録

```bash
READY_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
```

- 所要時間は `STARTED_AT` 〜 `READY_AT`（= 全 PR のセルフレビュー完了時）の秒数とする。
- `docs/experiments/pr-strategy/<run-id>/metrics.json` を Write で出力する。スキーマは
  [experiments ガイド](../../../docs/experiments/pr-strategy/README.md) の metrics.json に従う。

```json
{
  "run_id": "issue-<number>-split-<RUN_TS>",
  "issue": <number>,
  "approach": "split",
  "started_at": "<STARTED_AT>",
  "pr_first_opened_at": "<最初の PR オープン時刻>",
  "ready_at": "<READY_AT>",
  "elapsed_seconds": <READY_AT - STARTED_AT の秒数>,
  "prs": [
    { "number": <pr1>, "url": "<url1>", "opened_at": "<t1>", "part": 1, "review_rounds": 1, "findings_deferred": <n> }
  ],
  "split_count": <N>,
  "review_rounds": <N（各 PR 1 ターン）>,
  "findings_deferred": <全 PR の未解決指摘合計>,
  "notes": "<分割の根拠など>"
}
```

### Step 5 — 全 PR をオープンのまま停止

- どの PR もマージ・クローズしない。
- 最終サマリを報告する。
  - issue 番号 / タイトル
  - 分割数 N と各 PR 番号 / URL（open）/ レビュー判定
  - 所要時間（秒）と metrics.json のパス
  - 各 PR で残った指摘（あれば）

## ルール

- 対象は 1 issue を **複数 PR** に分割。分割数は 2〜5 を目安。
- 各 PR のセルフレビューは **1 ターンのみ**。再レビュー・反復はしない（反復は方針A `/pr-strategy-iterate` の担当）。
- マージ・クローズしない。最終状態は全 PR がオープン。
- 計測終了点は **全 PR のセルフレビュー完了時（READY_AT）**。マージのリードタイムは含めない。
- 各ステップの結果を確認してから次へ進む。回復不能な失敗は明確に報告して停止する。
