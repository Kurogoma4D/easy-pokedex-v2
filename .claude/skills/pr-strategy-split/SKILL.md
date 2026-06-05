---
name: pr-strategy-split
description: |
  方針B（分割 PR）で 1 つの GitHub issue を、ある程度細かい単位の複数 PR に分割して実装する。
  各 PR を独立 Subagent(github-issue-implementer)で実装し、独立 Subagent(code-reviewer)による
  セルフレビューと修正を「1 ターンのみ」行う（再レビューしない）。全 PR をオープンのまま残す。
  各マイルストーンを PR の行動記録(runlog)に残し、速度・分割数はその記録から集計する。
  `/pr-strategy-split <issue-number>` で起動する。
allowed-tools:
  - Bash
  - Task
  - Write
---

# PR Strategy B — 分割 PR・各 1 ターン

**easy-pokedex-v2**（`Kurogoma4D/easy-pokedex-v2`、Angular + Hono BFF の Pokédex アプリ）の
1 つの issue を、**ある程度細かい単位の複数 PR** に分割して実装する方針Bの実行スキル。

各 PR ごとにセルフレビューと修正を **1 ターンのみ** 行い（再レビューしない）、全 PR をオープンのまま残す。
計測の定義・runlog 形式・文脈隔離の原則は
[experiments ガイド](../../../docs/experiments/pr-strategy/README.md) に従う。

## 中核原則（厳守）

- **文脈隔離**: 実装・レビュー・修正はすべて独立 Subagent に依頼する。各 Subagent へのプロンプトは、その時点で取得した正準ソース（issue 本文 / 当該パートのスコープ / 対象 PR の diff / その PR に投稿されたレビュー指摘）のみから構成する。別 issue・別ラン・他パートで得た知見・自分が気づいた改善点を混入させない（特に同一 issue を A→B 順で回すとき、A 側の指摘を B の実装プロンプトへ持ち込まない）。
- **PR 行動記録**: 各 PR の各マイルストーンを runlog（コメント＋レビュー）として残す。速度・分割数は手元時計ではなく PR 記録から集計する。

## 入力

- issue 番号を引数で受け取る（例 `/pr-strategy-split 42`）。無い場合は最も古い open issue。

```bash
gh issue list --repo Kurogoma4D/easy-pokedex-v2 --state open --limit 1 -S "sort:created-asc" --json number,title,labels
```

- open issue が無ければ「対象 issue なし」と報告して停止する。

## ワークフロー

### Step 0 — 専用 worktree 作成・run-id 確定・作業開始時刻

このランは専用 worktree の中で実行し、Step 5 で削除する（メイン作業ツリーを汚さず、ブランチ取り違え事故を防ぐ）。
metrics.json はメインリポジトリ側のパスへ書き、worktree 削除後も残す。

```bash
MAIN_REPO="$(git rev-parse --show-toplevel)"
RUN_TS=$(date -u +%Y%m%dT%H%M%SZ)
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)   # 自己申告（最初の PR の work_started payload に残す）
RUN_ID="issue-<番号>-split-${RUN_TS}"
WT="${MAIN_REPO}-prstrat-${RUN_TS}"
git -C "$MAIN_REPO" fetch origin main -q
git -C "$MAIN_REPO" worktree add --detach "$WT" origin/main   # 最新 main 断面の専用 worktree
cd "$WT"
mkdir -p "$MAIN_REPO/docs/experiments/pr-strategy/${RUN_ID}"
echo "run-id=${RUN_ID} worktree=${WT}"
```

以降のステップ（issue 解決・分割計画・Subagent 委譲・runlog 投稿・集計）はこの worktree 内で行う。

### Step 1 — issue を解決

```bash
gh issue view <number> --repo Kurogoma4D/easy-pokedex-v2 --json number,title,labels,body
```

- open 確認・`wontfix`/`on-hold` 除外・依存 issue 未解決なら停止。

### Step 2 — 分割計画

- issue 本文のみを根拠に、レビュー可能で独立性の高い **2〜5 個の段階的なサブタスク**へ分割する。
- 各サブタスクは単体で build/test が通る粒度。後段は前段の作業ブランチを base にして積む。BFF/frontend・型・UI・テストの自然な切れ目で割る。
- 分割計画（番号・概要・依存順）をユーザーに提示してから実装に入る。

### Step 3 — 各サブタスクを実装＋1 ターンのレビュー（順次・独立 Subagent）

サブタスク `i = 1..N` を依存順に処理する。各サブタスクで:

1. **github-issue-implementer** に委譲。プロンプトは issue 本文と当該パートのスコープのみ。

```
Task tool:
  subagent_type: github-issue-implementer
  prompt: |
    Implement PART <i>/<N> of issue #<number> for easy-pokedex-v2 (Kurogoma4D/easy-pokedex-v2).
    Scope of THIS part (derive only from the issue body): <サブタスク i の説明>.
    Base: <i==1 なら main、それ以外は前段の作業ブランチ>(checkout && pull, then branch).
    Implement ONLY this part. Run install/lint/format/build/test. Open one focused PR referencing #<number>
    as "Part <i>/<N>" (use "Closes #<number>" only on the last part). Leave the primary checkout on main.
```

2. PR 番号 / URL を取得。PR 生成直後に runlog コメント `work_started`（part=i、最初のパートのみ `self_reported_started_at` を含める）を投稿。

3. **code-reviewer** に委譲（対象 PR の diff のみ）。

```
Task tool:
  subagent_type: code-reviewer
  prompt: |
    Review PR #<pr> in Kurogoma4D/easy-pokedex-v2. Judge ONLY this PR's own diff and the linked issue.
    Return findings, or "LGTM" if acceptable.
```

4. レビュー結果を PR レビューとして投稿: `gh pr review <pr> --comment --body "RUNLOG-REVIEW round=1 verdict=<...> findings=<n>\n\n<本文>"`。

5. 指摘ありなら **github-issue-implementer** に修正を **1 ターンだけ** 委譲（プロンプトには**その PR のレビュー指摘のみ**）。push 後 `fix_applied`(round=1) を投稿。**再レビューはしない。** 残/新規指摘は `findings_deferred` に計上。

6. その PR に `ready`(part=i, review_rounds=1) runlog コメントを投稿。

7. 次サブタスクはこの PR の作業ブランチを base に Step 3 を繰り返す。

### Step 4 — PR 記録から metrics を集計

全 PR の GitHub タイムスタンプを取得し、記録から計算する。

```bash
for pr in <pr1> <pr2> ...; do gh pr view $pr --repo Kurogoma4D/easy-pokedex-v2 --json number,url,createdAt,comments,reviews; done
```

- 各 PR: `opened_at`=`createdAt`、その PR の `ready` コメント `createdAt`、`review_rounds`=`RUNLOG-REVIEW` 件数。
- `pr_opened_at` = 全 PR の最早 `createdAt`。`ready_at` = 最終 `ready` コメントの `createdAt`。
- `elapsed_seconds` = `ready_at − pr_opened_at`（秒）。`split_count` = N。
- `$MAIN_REPO/docs/experiments/pr-strategy/${RUN_ID}/metrics.json` を Write（README スキーマ、`elapsed_source: "pr_records"`）。worktree 内でなくメイン側へ書くことで削除後も残す。

### Step 5 — worktree 削除・全 PR をオープンのまま停止・報告

```bash
cd "$MAIN_REPO"
git worktree remove --force "$WT"
```

- マージ・クローズしない。issue・分割数・各 PR 番号/URL/判定・`elapsed_seconds`・metrics パス・残指摘を報告。

## ルール

- 1 issue を **複数 PR**（2〜5 目安）に分割。各 PR のセルフレビューは **1 ターンのみ**（再レビューしない）。
- 実装・レビュー・修正は独立 Subagent。プロンプトは正準ソースのみ（中核原則）。
- マージ・クローズしない。計測は PR 記録から集計（最早 `pr_opened_at`〜最終 `ready_at`）。手元の `date` は補助のみ。
- このランは Step 0 で作成した専用 worktree 内で実行し、終了時（成功・失敗を問わず）必ず `git worktree remove --force "$WT"` で削除する。
- 各ステップの結果を確認してから次へ進む。回復不能な失敗は明確に報告して停止する。
