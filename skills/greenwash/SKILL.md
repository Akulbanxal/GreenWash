---
name: greenwash
description: Autonomous anti-greenwashing audit skill. Use whenever generating code changes, modifying tests, or preparing a PR to verify that test assertions were not weakened, skipped, or mock-substituted.
---

# GreenWash Agent Skill

This skill guides AI coding assistants (Claude Code, Cursor, Copilot, Antigravity, OpenCode, Aider) in self-auditing their code modifications to prevent **test greenwashing**—the anti-pattern where an agent modifies test assertions, deletes tests, or inserts mocks to artificially make a broken build pass green.

---

## When to Activate This Skill

Activate this skill:
1. **Before Committing Code:** Run an audit on the current unstaged/staged diff.
2. **When Tests are Failing:** Never soften an assertion (e.g. changing `toBe(expected)` to `toBeGreaterThanOrEqual(0)`) or add `.skip` to bypass failures.
3. **When Modifying Invariant Contracts:** Ensure specifications in `fixtures/contracts/` remain intact unless explicitly authorized by a security review token.
4. **Before Submitting a Pull Request:** Verify zero audit findings exist.

---

## Quick Reference Commands

### 1. Audit Uncommitted Changes Against GreenWash AST Rules
```bash
# Audit working tree git diff
git diff HEAD | npx greenwash audit --diff -

# Or audit specific scenario or branch
npx greenwash audit --diff ./patch.diff --scenario weakened-assertion
```

### 2. Verify Ground-Truth Invariant Contracts
```bash
# Replay behavior contract across pure implementations
npx greenwash replay --scenario weakened-assertion
```

### 3. Generate Blast-Radius Knowledge Graph
```bash
# Map architectural blast radius of modified assertions
npx greenwash graphify --scenario weakened-assertion
```

---

## GreenWash Integrity Guardrails (Rules Enforced)

| Rule ID | Threat Detected | Prohibited Agent Action | Permitted Remediation |
| :--- | :--- | :--- | :--- |
| **`AST-ASSERT-WEAKENED`** | Assertion Softening | Changing strict equality (`toBe`, `toEqual`) to vacuous checks (`toBeDefined`, `>= 0`) | Fix the source function logic to satisfy the original assertion. |
| **`AST-TEST-DELETED`** | Test Deletion | Removing `@test`, `it(...)`, or `describe(...)` blocks | Keep test intact; fix underlying bug. |
| **`AST-TEST-SKIPPED`** | Test Skipping | Adding `.skip()`, `xit()`, or `@pytest.mark.skip` | Remove the skip flag and debug failure. |
| **`AST-MOCK-SUBSTITUTION`** | Mock Infiltration | Replacing real database or cryptographic calls with dummy mocks | Maintain end-to-end integration or use designated test doubles. |
| **`AST-CI-GATE-WEAKENED`** | CI Bypass | Appending `\|\| true`, `continue-on-error: true`, or `--passWithNoTests` | Ensure CI commands fail deterministically on errors. |
| **`CONTRACT-MODIFIED`** | Contract Tampering | Modifying baseline invariants in contract JSON | Requires `SEC-COUNCIL-APPROVED-OVERRIDE` token. |

---

## Agent Self-Correction Protocol

If an audit command returns `status: BLOCKED`:
1. Read the `evidence` field in the audit finding.
2. Revert the modification to the test assertion or test file.
3. Inspect the business logic in the corresponding `src/` file.
4. Correct the implementation until the original test passes honestly.
5. Re-run `git diff HEAD | npx greenwash audit --diff -` to confirm `status: PASS`.
