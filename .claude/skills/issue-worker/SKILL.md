---
name: issue-worker
description: |
  Run the auto-issue-worker flow against a single GitHub issue: implement it via the
  issue-implementer agent, review the PR once with the code-reviewer agent, apply one round
  of fixes for any findings, then stop with the PR left open (no merge). Use when you want a
  single issue taken from open to a ready-for-review PR without merging.
  Invoke with `/issue-worker <issue-number>`.
allowed-tools:
  - Bash
  - Task
---

# Issue Worker

You process **one** GitHub issue for the **{{PROJECT_NAME}}** repository
(`{{GITHUB_OWNER}}/{{GITHUB_REPO}}`) end to end, then stop.
{{PROJECT_SHORT_DESCRIPTION}}

Unlike `/auto-issue-worker`, you do **not** loop over issues, you run the review **once**
(one review pass plus at most one round of fixes), and you **leave the PR open** — you never
merge.

## Input

- The issue number is passed as an argument (e.g. `/issue-worker 42`).
- If no number is given, pick the oldest open issue as a fallback:

```bash
gh issue list --repo {{GITHUB_OWNER}}/{{GITHUB_REPO}} --state open --limit 1 -S "sort:created-asc" --json number,title,labels
```

- If no number is given and there are no open issues, report "No open issues to work on" and stop.

## Workflow

### Step 1 — Resolve the issue

```bash
gh issue view <number> --repo {{GITHUB_OWNER}}/{{GITHUB_REPO}} --json number,title,labels,body
```

- Confirm the issue exists and is open. If it is closed, ask the user whether to proceed.
- Do not work on issues labeled `wontfix` or `on-hold` — report and stop.
- Check the issue's dependency section. If it depends on unresolved issues, report which
  dependencies are open and stop (do not silently skip — this skill targets one explicit issue).

### Step 2 — Implement the issue

Delegate implementation to the **github-issue-implementer** agent:

```
Task tool:
  subagent_type: github-issue-implementer
  prompt: "Implement issue #<number> for the {{PROJECT_NAME}} repository ({{GITHUB_OWNER}}/{{GITHUB_REPO}})."
```

- The agent creates a worktree, implements the change, runs quality checks, and opens a PR.
- Capture the resulting PR number/URL from the agent's output.

### Step 3 — Review the PR (single pass)

Delegate code review to the **code-reviewer** agent:

```
Task tool:
  subagent_type: general-purpose
  prompt: |
    You are a code reviewer. Follow the instructions in .claude/agents/code-reviewer.md.
    Review PR #<pr-number> in the {{GITHUB_OWNER}}/{{GITHUB_REPO}} repository.
    Return a list of issues found, or "LGTM" if the code is acceptable.
```

### Step 4 — Apply one round of fixes (if any)

- If the reviewer returned **LGTM**, skip to Step 5.
- If the reviewer returned findings, resume the issue-implementer agent (or launch a new one)
  to address them, then push the fixes.
- Do this **exactly once**. Do **not** re-review and do **not** loop. Any remaining or newly
  surfaced findings are reported to the user in the final summary so a human reviewer can
  decide on them.

### Step 5 — Stop with the PR open

- Do **not** merge the PR. Leave it open for human review.
- Report a final summary:
  - Issue number and title
  - PR number and URL (open)
  - Review verdict (LGTM or the findings list)
  - Whether a fix round was applied, and any findings deferred to the human reviewer

## Rules

- Work on exactly one issue — never loop to a second issue.
- Run the review only once, with at most one follow-up fix round.
- Never merge or close the PR; the end state is an open PR ready for human review.
- Confirm each step's outcome before proceeding.
- If any step fails unrecoverably, report the failure clearly and stop.
