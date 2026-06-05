---
name: pr-strategy-iterate
description: |
  方針A（反復セルフレビュー）で 1 つの GitHub issue を 1 本の PR に実装する。
  独立 Subagent(github-issue-implementer)で実装後、独立 Subagent(code-reviewer)による
  セルフレビューと修正を指摘点がなくなる（LGTM）まで繰り返し、PR をオープンのまま残す（マージしない）。
  各マイルストーンを PR の行動記録(runlog)に残し、速度・反復回数はその記録から集計する。
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
計測の定義・runlog 形式・文脈隔離の原則は
[experiments ガイド](../../../docs/experiments/pr-strategy/README.md) に従う。

## 中核原則（厳守）

- **文脈隔離**: 実装・レビュー・修正はすべて独立 Subagent に依頼する。各 Subagent へのプロンプトは、その時点で取得した正準ソース（issue 本文 / 対象 PR の diff / その PR に投稿されたレビュー指摘）のみから構成する。別 issue・別ラン・自分が気づいた知見を混入させない。
- **PR 行動記録**: 各マイルストーンを PR の runlog（コメント＋レビュー）として残す。速度・反復回数は手元時計ではなく PR 記録から集計する。

## 入力

- issue 番号を引数で受け取る（例 `/pr-strategy-iterate 42`）。無い場合は最も古い open issue。

```bash
gh issue list --repo Kurogoma4D/easy-pokedex-v2 --state open --limit 1 -S "sort:created-asc" --json number,title,labels
```

- open issue が無ければ「対象 issue なし」と報告して停止する。

## ワークフロー

### Step 0 — 専用 worktree 作成・run-id 確定・作業開始時刻

このランは専用 worktree の中で実行し、Step 7 で削除する（メイン作業ツリーを汚さず、ブランチ取り違え事故を防ぐ）。
metrics.json はメインリポジトリ側のパスへ書き、worktree 削除後も残す。

```bash
MAIN_REPO="$(git rev-parse --show-toplevel)"
RUN_TS=$(date -u +%Y%m%dT%H%M%SZ)
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)   # 自己申告（PR 生成前のため記録は payload のみ）
RUN_ID="issue-<番号>-iterate-${RUN_TS}"
WT="${MAIN_REPO}-prstrat-${RUN_TS}"
git -C "$MAIN_REPO" fetch origin main -q
git -C "$MAIN_REPO" worktree add --detach "$WT" origin/main   # 最新 main 断面の専用 worktree
cd "$WT"
mkdir -p "$MAIN_REPO/docs/experiments/pr-strategy/${RUN_ID}"
echo "run-id=${RUN_ID} worktree=${WT}"
```

以降のステップ（issue 解決・Subagent 委譲・runlog 投稿・集計）はこの worktree 内で行う。

### Step 1 — issue を解決

```bash
gh issue view <number> --repo Kurogoma4D/easy-pokedex-v2 --json number,title,labels,body
```

- open であることを確認（closed なら続行可否を確認）。`wontfix`/`on-hold` は対象外。依存 issue 未解決なら停止。

### Step 2 — 実装（独立 Subagent / 1 本にまとめる）

**github-issue-implementer** に委譲する。プロンプトは issue 本文のみから構成し、他ランの知見を入れない。

```
Task tool:
  subagent_type: github-issue-implementer
  prompt: |
    Implement issue #<number> for easy-pokedex-v2 (Kurogoma4D/easy-pokedex-v2) as a SINGLE PR covering the whole issue.
    Base: latest main (checkout main && pull, then branch `issue-<number>`).
    Requirements come ONLY from the issue body below — do not add scope from anywhere else.
    <issue body をそのまま貼る>
    Run install/lint/format/build/test, open one PR with "Closes #<number>", and leave the primary checkout on main.
```

- 出力から PR 番号 / URL を取得する。

### Step 3 — work_started を runlog に記録

PR 生成直後に runlog コメントを投稿する（README の形式）。

```bash
gh pr comment <pr> --repo Kurogoma4D/easy-pokedex-v2 --body "$(printf '<!-- pr-runlog:work_started -->\n```json\n{"event":"work_started","approach":"iterate","issue":<number>,"run_id":"issue-<number>-iterate-%s","self_reported_started_at":"%s"}\n```' "$RUN_TS" "$STARTED_AT")"
```

### Step 4 — セルフレビュー（指摘がなくなるまで反復・独立 Subagent）

ラウンド `k=1,2,...`:

1. **code-reviewer** に委譲（対象 PR の diff のみを正準ソースとする）。

```
Task tool:
  subagent_type: code-reviewer
  prompt: |
    Review PR #<pr> in Kurogoma4D/easy-pokedex-v2. Judge ONLY this PR's own diff and the linked issue.
    Return findings, or "LGTM" if acceptable.
```

2. レビュー結果を PR にレビューとして投稿（不変タイムスタンプを残す）。

```bash
gh pr review <pr> --repo Kurogoma4D/easy-pokedex-v2 --comment \
  --body "RUNLOG-REVIEW round=<k> verdict=<LGTM|CHANGES_REQUESTED> findings=<n>

<レビュー本文>"
```

3. **LGTM** なら Step 5 へ。指摘ありなら **github-issue-implementer** に修正を委譲する。修正プロンプトには、**その PR に投稿された当該レビューの指摘だけ**を貼る（他ランの知見は不可）。push 後に runlog コメント `fix_applied`(round=k) を投稿し、**Step 4 の先頭へ戻って再レビュー**する。

4. 上限 **8 ラウンド**。到達しても LGTM でなければ残指摘を `findings_deferred` とし、その旨を報告して進む。

### Step 5 — ready を runlog に記録

```bash
gh pr comment <pr> --repo Kurogoma4D/easy-pokedex-v2 --body "$(printf '<!-- pr-runlog:ready -->\n```json\n{"event":"ready","approach":"iterate","issue":<number>,"run_id":"issue-<number>-iterate-%s","review_rounds":<k>,"findings_deferred":<n>}\n```' "$RUN_TS")"
```

### Step 6 — PR 記録から metrics を集計

PR の GitHub タイムスタンプを取得し、手元時計ではなく**記録から**計算する。

```bash
gh pr view <pr> --repo Kurogoma4D/easy-pokedex-v2 --json number,url,createdAt,comments,reviews
```

- `pr_opened_at` = `createdAt`。`ready_at` = `ready` runlog コメントの `createdAt`。
- `review_rounds` = `RUNLOG-REVIEW` レビュー件数。
- `elapsed_seconds` = `ready_at − pr_opened_at`（秒）。
- `$MAIN_REPO/docs/experiments/pr-strategy/${RUN_ID}/metrics.json` を Write（README の metrics スキーマ、`elapsed_source: "pr_records"`）。worktree 内でなくメイン側へ書くことで削除後も残す。

### Step 7 — worktree 削除・オープンのまま停止・報告

```bash
cd "$MAIN_REPO"
git worktree remove --force "$WT"
```

- マージ・クローズしない。issue/PR・反復回数・最終判定・`elapsed_seconds`・metrics パス・残指摘を報告。

## ルール

- 対象は 1 issue・**1 PR**。分割しない（分割は方針B）。
- 実装・レビュー・修正は独立 Subagent。プロンプトは正準ソースのみ（中核原則）。
- レビューは LGTM まで反復（上限 8）。マージ・クローズしない。
- 計測は PR 記録から集計する（`pr_opened_at`〜`ready_at`）。手元の `date` 値は補助のみ。
- このランは Step 0 で作成した専用 worktree 内で実行し、終了時（成功・失敗を問わず）必ず `git worktree remove --force "$WT"` で削除する。
- 各ステップの結果を確認してから次へ進む。回復不能な失敗は明確に報告して停止する。
