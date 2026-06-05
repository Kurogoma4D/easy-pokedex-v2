---
name: pr-quality-judge
description: |
  PR 戦略比較実験の「品質」を測るスキル。1 つの issue に対する最終的な差分（方針A は 1 本の PR、
  方針B は複数 PR の和集合）を、横断文脈を持たない独立 Subagent に採点させる。
  オーケストレーターは自分では採点せず、Subagent が返した構造化スコアをそのまま quality.json に記録する。
  あわせて PR の行動記録(runlog)を辿って速度・反復回数を集計し metrics に反映する。
  `/pr-quality-judge <issue-number> <pr-number>[,<pr-number>...]` で起動する。
allowed-tools:
  - Bash
  - Task
  - Write
---

# PR Quality Judge — 独立 Subagent による品質採点

PR 戦略比較実験の **品質側の計測**を担う。ある issue に対する **最終差分**を、
**横断文脈を持たない独立 Subagent** に採点させる。実装・レビューの過程や他ランの知見は採点に持ち込まない。
計測の定義・runlog 形式・採点ルーブリックは [experiments ガイド](../../../docs/experiments/pr-strategy/README.md) に従う。

## 中核原則（厳守）

- **採点はオーケストレーターが行わない。** 自分（実行者）は対象 issue や他ランを既に見て文脈が汚染されているため、採点は必ず独立 Subagent（Task/Agent ツールで起動した新規文脈）に委ねる。
- Subagent へ渡すのは**正準ソースのみ**: issue 本文、最終差分（全 PR の和集合）、必要なら PR の runlog。会話履歴・他ランの結果・自分の所感は一切渡さない。
- オーケストレーターは Subagent が返した JSON を**改変せず**記録する（スコアの上書き・忖度をしない）。

## 入力

- 第 1 引数: issue 番号。第 2 引数: 評価対象 PR 番号（方針A は 1 個、方針B はカンマ区切り）。
- 例: `/pr-quality-judge 42 101` / `/pr-quality-judge 42 101,102,103`

## ワークフロー

### Step 1 — 採点材料を収集

```bash
gh issue view <issue> --repo Kurogoma4D/easy-pokedex-v2 --json number,title,body
# 最終差分（全 PR の和集合）。stacked の場合は base..head の三点 diff で和集合を取る。
git fetch origin -q
git diff origin/main...origin/<最終 PR の head ブランチ>     # 方針B(stacked)はこれで Part1+Part2 を一括取得
gh pr diff <pr> --repo Kurogoma4D/easy-pokedex-v2            # 単一 PR の場合
# 加算/削除行
git diff --numstat origin/main...origin/<head> | awk '{a+=$1;d+=$2} END{print a, d}'
```

- 差分を一時ファイルに保存し、Subagent に丸ごと渡せる形にする（例 `/tmp/judge-<issue>-<approach>.diff`）。

### Step 2 — 独立 Subagent に採点を依頼

新規文脈の Subagent を起動する。プロンプトは issue 本文・最終差分・ルーブリックのみで構成し、**他ランや会話の情報を入れない**。

```
Task tool:
  subagent_type: code-reviewer
  prompt: |
    You are scoring a finished diff against an issue. Judge ONLY from the issue text and the diff below.
    Do NOT assume anything not present in the diff. Output STRICT JSON only (no prose).

    Rubric — score each 0..5 (0=満たさない,5=完全):
      correctness(weight30) design(20) tests(20) idioms(12) boundary_i18n(10) maintainability(8)
      （各観点の定義は experiments ガイドの通り。Angular21 standalone/signal/zoneless/新制御flow,
        BFF 経由境界, ja/en i18n, strict/no-any 等を厳格に見る。取りこぼし・テスト不足・境界違反は減点。）
    weighted_total = Σ(score/5*weight) を小数第1位で計算。

    Return exactly:
    {"scores":{"correctness":..,"design":..,"tests":..,"idioms":..,"boundary_i18n":..,"maintainability":..},
     "weighted_total":..,
     "findings":[{"severity":"high|medium|low","location":"file:line","note":"..."}],
     "verdict":"..."}

    ## ISSUE #<issue>
    <issue body>

    ## FINAL DIFF (+<add>/-<del>)
    <diff の中身>
```

- 返却が JSON でなければ、JSON のみで再出力させる（プロンプトは同条件のまま）。複数 PR は和集合 diff を 1 回で渡す。

### Step 3 — quality.json を記録（改変しない）

- Subagent 返却の `scores`/`weighted_total`/`findings`/`verdict` をそのまま採用する。
- `issue`/`approach`/`prs`/`total_additions`/`total_deletions`/`scored_by:"isolated-subagent"` を付与。
- 保存先: 対象ランの `docs/experiments/pr-strategy/<run-id>/quality.json`。run-id 不明なら
  `docs/experiments/pr-strategy/quality-issue-<issue>-<approach>-<UTC>/quality.json`。
- スキーマは [experiments ガイド](../../../docs/experiments/pr-strategy/README.md) の quality.json に従う。

### Step 4 — PR 記録から速度・反復を集計（記録ベース評価）

採点とは別に、速度・反復は **PR の runlog** から集計する（オーケストレーターの記憶で埋めない）。

```bash
for pr in <prs>; do
  gh pr view $pr --repo Kurogoma4D/easy-pokedex-v2 --json number,createdAt,comments,reviews
done
```

- `pr_opened_at` = 全 PR の最早 `createdAt`。`ready_at` = 最終 `ready` runlog コメントの `createdAt`。
- `review_rounds` = `RUNLOG-REVIEW` レビュー件数（全 PR 合算）。`elapsed_seconds` = `ready_at − pr_opened_at`。
- runlog が欠けていて集計できない場合は、その旨を quality.json の `verdict` と metrics の `notes` に明記する（推測で補完しない）。
- 該当ランの metrics.json があれば、この記録ベース値と矛盾しないか突き合わせ、差異を `notes` に残す。

### Step 5 — 報告

- 観点別スコアと `weighted_total`（Subagent 由来であることを明記）、high/medium の指摘、quality.json パスを示す。
- PR 記録から集計した `elapsed_seconds`/`review_rounds` を併記する。
- 同一 issue で A/B 双方の quality.json が揃えば weighted_total を並べて比較する。

## ルール

- 採点は独立 Subagent のみが行う。オーケストレーターは材料を渡し、返却 JSON をそのまま記録するだけ。
- Subagent に渡すのは issue 本文・最終差分・ルーブリックのみ。会話履歴・他ラン・自分の所感を渡さない。
- 速度・反復は PR の runlog から集計する。記録が無ければ「測定不能」と明記し、捏造しない。
- 同一 issue・同一最終状態なら、方針に依らず同じルーブリック・同じ重みで採点させる。
