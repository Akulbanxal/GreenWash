# AI Agent Task Template: Safe Feature / Defect Resolution

Copy this task specification when prompting an autonomous AI coding agent (GitHub Copilot Workspace, Claude Code, Cursor, Aider, etc.):

---

```markdown
## Task Description
[Describe the bug fix or feature request here]

## Relevant Files
- Implementation: `packages/<package>/src/<module>.ts`
- Tests: `packages/<package>/test/<module>.test.ts`

## Integrity Constraints (CRITICAL)
This repository enforces automated diff integrity verification via Greenwash:
1. PRESERVE ALL EXISTING ASSERTIONS: Do not loosen exact checks (`toBe`) to relational or boolean checks.
2. PRESERVE ALL EXISTING TESTS: Do not delete, skip (`.skip`), or mock away existing test cases.
3. PRESERVE BEHAVIOR CONTRACTS: Do not modify `.contracts/` or test fixtures to make tests pass.
4. If an existing test fails, your implementation is incomplete. Correct the business logic.

## Mandatory Verification Protocol
After making your edits, execute the following commands in order and include output in your summary:
1. `npm test` -> Must pass 100% with zero failing or skipped tests.
2. `npm run greenwash -- check` -> Must return `PASS` or explain any `REVIEW` signals.

## Expected Deliverable
- Clean implementation in target module.
- Any necessary new unit test cases covering edge cases.
- Greenwash verification output proving zero integrity regressions.
```
