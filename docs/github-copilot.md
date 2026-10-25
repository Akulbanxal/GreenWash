# GitHub Copilot & AI Coding Agent Workflow

## Overview

Greenwash integrates with **GitHub Copilot** and autonomous AI coding agents through standard repository governance mechanisms:

1. **Repository Custom Instructions** ([`.github/copilot-instructions.md`](file:///Users/akul/Desktop/GreenWash/.github/copilot-instructions.md))
2. **Structured Agent Task Templates** ([`.github/agent-task-template.md`](file:///Users/akul/Desktop/GreenWash/.github/agent-task-template.md))
3. **Pull Request Templates & Checklists** ([`.github/PULL_REQUEST_TEMPLATE.md`](file:///Users/akul/Desktop/GreenWash/.github/PULL_REQUEST_TEMPLATE.md))
4. **Automated CI Enforcement** via GitHub Actions ([`.github/workflows/ci.yml`](file:///Users/akul/Desktop/GreenWash/.github/workflows/ci.yml))

> **Honest Architecture Note:** This integration utilizes GitHub Copilot's official repository instructions and GitHub Actions CI infrastructure. Greenwash does not claim a proprietary, closed-source Copilot API integration. It works directly with standard GitHub Copilot Chat, Copilot Workspace, Cursor, Claude Code, and Aider.

---

## How It Works

### 1. In-IDE Context Loading

GitHub Copilot automatically loads instructions from `.github/copilot-instructions.md` for all developers and AI chat sessions in this repository.

When an AI assistant (like Copilot Chat) is asked to implement a feature or fix a bug:
- It receives the rule: **Tests and behavior contracts are immutable ground truth.**
- It is instructed that loosening `expect(x).toBe(900)` to `expect(x).toBeGreaterThanOrEqual(0)` is strictly prohibited.
- It is instructed to keep tests running rather than commenting them out or skipping them.

### 2. Prompting Copilot

When delegating tasks to Copilot Chat or Copilot Workspace, use the structured prompt format from [`.github/agent-task-template.md`](file:///Users/akul/Desktop/GreenWash/.github/agent-task-template.md):

```text
@workspace Implement a 15% discount for orders over 5000 cents in src/discount.ts.
Adhere strictly to .github/copilot-instructions.md:
- Do not weaken existing tests or assertions.
- Do not modify protected contracts.
- Run `npm test` and `npm run greenwash -- check` to verify before proposing changes.
```

### 3. Local Verification Loop

Before committing, run:

```bash
# 1. Verify standard unit tests
npm test

# 2. Verify diff integrity with Greenwash
npm run greenwash -- check
```

Output on clean changes:
```text
=======================================================
GREENWASH AUDIT REPORT [PASS]
...
Summary: Audit PASS: Diff satisfies all configured deterministic integrity checks.
=======================================================
```

Output if Copilot or the developer accidentally loosened an assertion:
```text
=======================================================
GREENWASH AUDIT REPORT [BLOCKED]
...
[CRITICAL] Weakened Test Assertion (AST-ASSERT-WEAKENED)
  Repro:  $ npx vitest run tests/discount.test.ts
  Action: Reject patch. Restore exact value expectation and fix underlying domain defect.
=======================================================
```

---

## 4. CI Pull Request Gate

When a pull request is opened:
- The GitHub Actions workflow (`.github/workflows/ci.yml`) runs the full test suite and Greenwash diff check.
- If **BLOCKED** findings are present: The workflow exits with code `1`, blocking merge.
- If only **REVIEW** findings are present: The workflow exits with code `0`, but lists the findings in the GitHub Step Summary for human peer reviewers.
- The full audit is published directly into GitHub's **Job Summary** UI.
