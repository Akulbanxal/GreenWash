# GitHub Copilot & AI Coding Agent Instructions

These instructions guide GitHub Copilot, Copilot Chat, and all AI coding assistants operating within this repository.

---

## 🛡️ Core Integrity Invariant

**Tests and Protected Behavior Contracts are the Immutable Ground Truth.**

When a test fails during implementation or refactoring:
- The default assumption is that your **implementation logic is incorrect or incomplete**.
- **NEVER** weaken, delete, or skip existing tests to make a test suite pass.
- **NEVER** edit contracts in `.contracts/`, `fixtures/`, or approved schema definitions merely to eliminate an audit finding.

---

## 🚫 Strictly Prohibited Evasion Patterns

The Greenwash diff auditor inspects all pull requests against deterministic rules. The following changes will cause the CI pipeline to immediately **BLOCK** your pull request:

1. **Weakening Assertions (`AST-ASSERT-WEAKENED`)**:
   - ❌ Replacing exact checks with loosened relational or truthy checks:
     - `expect(x).toBe(900)` ➡️ `expect(x).toBeGreaterThanOrEqual(0)`
     - `expect(status).toBe(200)` ➡️ `expect(status).toBeTruthy()`
     - `assert.strictEqual(a, b)` ➡️ `assert.ok(a)`
   - ✅ **Correct Action:** Fix the business logic so `x === 900` or `status === 200`.

2. **Deleting Tests (`AST-TEST-DELETED`)**:
   - ❌ Removing `it(...)`, `test(...)`, or `describe(...)` blocks that fail on your changes.
   - ✅ **Correct Action:** If a test is genuinely obsolete due to a formal product deprecation, provide documented architectural rationale and request human approval.

3. **Skipping Tests (`AST-TEST-SKIPPED`)**:
   - ❌ Adding `.skip`, `.todo`, `xit(...)`, or commenting out tests.
   - ✅ **Correct Action:** Keep tests enabled; fix the underlying defect.

4. **Excessive / Unconstrained Mock Substitutions (`AST-MOCK-SUBSTITUTION`)**:
   - ❌ Replacing verified real modules with broad mock objects that return dummy truthy values (`vi.fn().mockReturnValue(true)`).
   - ✅ **Correct Action:** Test with real module logic or approved mock fixtures.

5. **CI Gate Suppression (`CI-GATE-SUPPRESSION`)**:
   - ❌ Adding flags like `--passWithNoTests`, `|| true`, or removing `npm test` from CI scripts or package.json.
   - ✅ **Correct Action:** Keep CI validation gates strict and fully executing.

6. **Contract Tampering (`CONTRACT-MODIFIED`)**:
   - ❌ Editing behavior contracts in `.contracts/` or `fixtures/scenarios/` to match flawed candidate output.
   - ✅ **Correct Action:** Contract updates require human reviewer cryptographic signature and formal review via `/api/contracts/review-update`.

---

## 🔄 Mandatory Developer & Agent Workflow

Before proposing completion, opening a pull request, or presenting code changes:

1. **Implement Feature or Bug Fix:** Write clean code strictly in domain packages (`src/`, `packages/`).
2. **Run Local Test Suite:**
   ```bash
   npm test
   ```
   Ensure all existing and new unit tests pass cleanly.
3. **Run Local Greenwash Integrity Audit:**
   ```bash
   npm run greenwash -- check
   ```
4. **Inspect Findings:**
   - If status is `BLOCKED`: Examine the evidence, find the rule ID, and restore exact assertions or fix behavior.
   - If status is `REVIEW`: Review the flagged items. If genuine, document why the change was necessary in your pull request description.
5. **Attach Evidence:**
   - Mention the Greenwash audit status (`PASS` or `REVIEW`) in your commit message and PR description.
