# GitHub Actions CI Workflow & Partner Track Evidence

## Overview

Greenwash provides an official GitHub Actions workflow ([`.github/workflows/ci.yml`](file:///Users/akul/Desktop/GreenWash/.github/workflows/ci.yml)) that serves as the automated integrity gate for all Pull Requests and commits to `main`.

---

## Fork Safety & Threat Model

Public open-source repositories often receive contributions from untrusted external forks. A compromised or hostile pull request must never be able to exfiltrate secrets or execute privileged actions.

### Security Guarantees:

1. **Minimal Permissions:**
   ```yaml
   permissions:
     contents: read
     pull-requests: read
   ```
   The workflow explicitly drops write permissions. No access tokens with write privileges are provisioned.

2. **Zero Secret Exposure:**
   - The diff audit runs **100% locally and deterministically**.
   - No database credentials (`MONGODB_URI`), telemetry DSNs (`SENTRY_DSN`), or LLM API keys are required for CI pull request auditing.
   - Secrets are never passed to fork-triggered workflows.

3. **Safe Diff Generation:**
   - Diffs are computed using standard git read-only comparisons:
     ```bash
     git diff "origin/${{ github.base_ref }}...HEAD" > /tmp/pr.diff
     ```
   - No untrusted build scripts or postinstall hooks from the PR run with elevated privileges during the audit step.

4. **Third-Party Action Constraints:**
   - Pinned to official verified actions (`actions/checkout@v4`, `actions/setup-node@v4`).

---

## Exit Status Policy: Blocking vs. Review Findings

| Status | Exit Code | CI Result | Behavior |
| :---: | :---: | :---: | :--- |
| **PASS** | `0` | ✅ Green | All checks passed. Pull request satisfies all integrity criteria. |
| **REVIEW** | `0` | ✅ Green with Note | Suspicious signals (e.g. model-assisted review items) detected. Published to GitHub Step Summary for human reviewers, but does **not** fail the build. |
| **BLOCKED** | `1` | ❌ Red (Blocked) | Critical integrity violations (e.g. weakened assertions, deleted tests, modified contracts) detected. Merge blocked. |

---

## GitHub Partner Track: Required Evidence Checklist

Before claiming the **GitHub Partner Track / Integration Certification**, the following verified evidence must be collected from a live repository:

### 1. Repository Configuration
- [ ] Valid `.github/workflows/ci.yml` committed to default branch.
- [ ] Valid `.github/copilot-instructions.md` committed to default branch.
- [ ] Valid `.github/PULL_REQUEST_TEMPLATE.md` in repository.

### 2. Live Run Evidence
- [ ] **Clean PR Run:** A successful pull request run with a clean diff showing the `PASS` Job Summary badge.
- [ ] **Blocked PR Run:** A demonstration pull request containing an intentional weakened assertion (`expect.toBeGreaterThanOrEqual(0)`) showing:
  - Exit code `1`
  - GitHub Actions run marked as Failed ❌
  - GitHub Step Summary displaying the exact rule ID `AST-ASSERT-WEAKENED`, file location, and actionable human remedy.
- [ ] **Job Summary Markdown:** Verified rendering in the GitHub Actions "Summary" tab with markdown tables, icons, and sanitized excerpts.

### 3. Fork Safety Verification
- [ ] Successful execution on an external fork PR without secrets configured.

---

## Local Reproduction Commands

To reproduce the exact CI check locally before pushing:

```bash
# Clean install matching CI
npm ci

# Typecheck and build
npm run build

# Run test suite
npm test

# Generate local diff against main
git diff origin/main...HEAD > /tmp/local.diff

# Run Greenwash diff integrity check with GitHub Step Summary format
node packages/cli/dist/index.js check \
  --diff /tmp/local.diff \
  --base origin/main \
  --format github
```
