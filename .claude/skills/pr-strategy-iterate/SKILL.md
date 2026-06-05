---
name: pr-strategy-iterate
description: |
  方針A（反復セルフレビュー）で 1 つの GitHub issue を 1 本の PR に実装する。
  github-issue-implementer で実装後、code-reviewer によるセルフレビューと修正を
  指摘点がなくなる（LGTM）まで繰り返し、PR をオープンのまま残す（マージしない）。
  作業開始からセルフレビュー完了までの所要時間と反復回数を計測し metrics.json に記録する。
  `/pr-strategy-iterate <issue-number>` で起動する。
allowed-tools:
  - Bash
  - Task
  - Write
---

# PR Strategy A — 反復セルフレビュー

**easy-pokedex-v2**（`Kurogoma4D/easy-pokedex-v2`、Angular + Hono BFF の Pokédex アプリ）の
1 つの issue を、**1 本の PR** に実装する方針Aの実行スキル。

実装後、セルフレビューと修正を**指摘点がなくなるまで繰り返す**。PR はオープンのまま残し、マージしない。
PR 戦略の比較実験（方針A vs 方針B）の片側を担う。計測の定義と保存形式は
[experiments ガイド](../../../docs/experiments/pr-strategy/README.md) に従う。

## 入力

- issue 番号を引数で受け取る（例 `/pr-strategy-iterate 42`）。
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

- `run-id` は `issue-<番号>-iterate-<RUN_TS>` とする。
- 出力先ディレクトリ `docs/experiments/pr-strategy/<run-id>/` を作成する。

### Step 1 — issue を解決

```bash
gh issue view <number> --repo Kurogoma4D/easy-pokedex-v2 --json number,title,labels,body
```

- issue が open であることを確認する。closed なら続行可否をユーザーに確認する。
- `wontfix` / `on-hold` ラベルの issue は対象外として報告し停止する。
- 依存 issue が未解決なら、どれが open かを報告して停止する。

### Step 2 — 実装（1 本にまとめる）

**github-issue-implementer** エージェントに実装を委譲する。

```
Task tool:
  subagent_type: github-issue-implementer
  prompt: "Implement issue #<number> for the easy-pokedex-v2 repository (Kurogoma4D/easy-pokedex-v2) as a SINGLE pull request covering the whole issue. Start from the latest main: check out `main` and pull before creating the work branch. Run all quality checks (install/lint/format/build/test) and open one PR."
```

- エージェントが worktree 作成・実装・品質チェック・PR 作成を行う。
- 出力から PR 番号 / URL を取得する。取得直後に最初の PR オープン時刻を記録する。

```bash
PR_FIRST_OPENED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
```

### Step 3 — セルフレビュー（指摘がなくなるまで反復）

**code-reviewer** エージェントでレビューする。

```
Task tool:
  subagent_type: code-reviewer
  prompt: |
    Review PR #<pr-number> in the Kurogoma4D/easy-pokedex-v2 repository.
    Return a list of issues found, or "LGTM" if the code is acceptable.
```

- **LGTM** なら Step 4 へ。
- 指摘があれば github-issue-implementer を再開（または再起動）して全指摘を修正し push したうえで、**Step 3 に戻って再レビューする**。
- これを LGTM まで繰り返す。反復回数を `review_rounds` として数える。
- 無限ループ防止のため上限 **8 ラウンド**。到達しても LGTM でない場合は残指摘を `findings_deferred` として記録し、その旨を報告して次へ進む。

### Step 4 — 計測終了と metrics 記録

```bash
READY_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
```

- 所要時間は `STARTED_AT` 〜 `READY_AT`（= セルフレビュー完了時）の秒数とする。
- `docs/experiments/pr-strategy/<run-id>/metrics.json` を Write で出力する。スキーマは
  [experiments ガイド](../../../docs/experiments/pr-strategy/README.md) の metrics.json に従う。

```json
{
  "run_id": "issue-<number>-iterate-<RUN_TS>",
  "issue": <number>,
  "approach": "iterate",
  "started_at": "<STARTED_AT>",
  "pr_first_opened_at": "<PR_FIRST_OPENED_AT>",
  "ready_at": "<READY_AT>",
  "elapsed_seconds": <READY_AT - STARTED_AT の秒数>,
  "prs": [{ "number": <pr>, "url": "<url>", "opened_at": "<PR_FIRST_OPENED_AT>" }],
  "review_rounds": <反復回数>,
  "findings_deferred": <未解決指摘数>,
  "notes": "<特記事項>"
}
```

### Step 5 — オープンのまま停止

- PR はマージ・クローズしない。
- 最終サマリを報告する。
  - issue 番号 / タイトル
  - PR 番号 / URL（open）
  - 反復回数 / 最終レビュー判定
  - 所要時間（秒）と metrics.json のパス
  - 上限到達で残った指摘（あれば）

## ルール

- 対象は 1 issue・**1 PR**。分割しない（分割は方針B `/pr-strategy-split` の担当）。
- レビューは LGTM まで反復する。上限は 8 ラウンド。
- マージ・クローズしない。最終状態はレビュー済みのオープン PR。
- 計測終了点は **セルフレビュー完了時（READY_AT）**。マージのリードタイムは含めない。
- 各ステップの結果を確認してから次へ進む。回復不能な失敗は明確に報告して停止する。
