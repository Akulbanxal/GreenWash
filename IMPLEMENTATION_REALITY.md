# GREENWASH — Implementation Reality Audit

**Audit Date:** October 23, 2026  
**Auditor:** GreenWash Core Engineering  
**Scope:** Verification of actual repository code, fixtures, adapters, tests, and documentation claims.

---

## 1. Feature & Reality Verification Matrix

| Feature / Claim | Source File or Test | Actual Status | Smallest Action to Make Honest & Useful |
| :--- | :--- | :--- | :--- |
| **Deterministic AST Scanner** | `packages/core/src/rules/scanner.ts`<br>`packages/core/test/rules.test.ts` | **Working** | Accurately document the **6 core rule classes / 7 rule IDs** actually implemented. Remove unsubstantiated references to "14 rules". |
| **Weakened Assertion Detection (`AST-ASSERT-WEAKENED`)** | `packages/core/src/rules/assertionWeakening.ts`<br>`packages/core/test/rules.test.ts` | **Working** | Verified on Babel AST matching `toBeGreaterThanOrEqual`, `toBeTruthy`, `toBeDefined`, and relational expressions replacing strict equality matchers. |
| **Test Deletion Detection (`AST-TEST-DELETED`)** | `packages/core/src/rules/testDeletion.ts`<br>`packages/core/test/rules.test.ts` | **Working** | Scans chunk deletions for `it()`, `test()`, `describe()` AST blocks. Verified in regression suite. |
| **Test Skipping Detection (`AST-TEST-SKIPPED`)** | `packages/core/src/rules/testSkipping.ts`<br>`packages/core/test/rules.test.ts` | **Working** | Detects `.skip`, `xit`, `xtest`, and `it.only` directives. Standardize documentation on TypeScript/Vitest; remove claims of full Python/pytest execution. |
| **Mock Substitution Detection (`AST-MOCK-SUBSTITUTION`)** | `packages/core/src/rules/mockSubstitution.ts`<br>`packages/core/test/rules.test.ts` | **Working** | Emits `REVIEW` (advisory) for unconstrained return substitutions on units under test (`mockReturnValue(true)`). |
| **CI Gate Weakening (`CI-GATE-SUPPRESSION`, `CI-THRESHOLD-REDUCED`)** | `packages/core/src/rules/ciGateWeakening.ts`<br>`packages/core/test/rules.test.ts` | **Working** | Scans CI YAML files for `|| true`, `continue-on-error: true`, and lowered percentage numbers. |
| **Behavior Contract Invariant Replay** | `packages/core/src/replay/runner.ts`<br>`packages/core/test/replay.test.ts` | **Working** | Replays versioned JSON contracts against target functions. Expected 900 vs actual 1000 properly triggers `CONTRACT-VIOLATION`. |
| **Mastra Agentic Workflow Pipeline** | `packages/core/src/mastra/workflow.ts`<br>`packages/core/test/mastra-workflow.test.ts` | **Working** | Accurately document that the pipeline consists of **6 canonical steps** (`validate-scenario-diff` -> `deterministic-scan` -> `contract-replay` -> `semantic-analysis` -> `normalize-report` -> `emit-trace`). Reconcile older "5-step" wording. |
| **Local Gemma AI Reviewer (Ollama)** | `packages/core/src/gemma/GemmaSemanticReviewer.ts`<br>`packages/core/test/gemma.test.ts` | **Working** | Real local inference verified with `gemma:2b` on Ollama (`11434`). Added temperature 0.1, HTTP 500 retry, and heuristic fallback. Model is strictly advisory; never overrides `BLOCKED`. |
| **Entire CLI Agent Session Ingestion** | `packages/core/src/provenance/EntireSessionProvider.ts`<br>`packages/core/test/provenance.test.ts` | **Sample-Only** | Correctly label the default checked-in session as a **sample provenance dataset** (`fixtures/provenance/entire-session.json`). Real live CLI connection is only indicated when `ENTIRE_SESSION_PATH` points to an active external log file. |
| **Sentry Distributed Tracing** | `packages/core/src/sentry/index.ts`<br>`packages/core/test/sentry-tracing.test.ts` | **Partial** | OpenTelemetry spans are emitted if `SENTRY_DSN` is set. When unset, system accurately reports `NOT_CONFIGURED` with zero synthetic spans. Remove any "zero cloud egress" claims when Sentry is enabled. |
| **MongoDB Atlas Persistence** | `packages/core/src/persistence/MongoAuditRepository.ts`<br>`packages/core/test/mongodb-persistence.test.ts` | **Working (Dual-Mode)** | Connects to Atlas with masked URI and canary write probes when `MONGODB_URI` is provided; automatically falls back to in-memory store when unset. Clearly label storage mode in UI. |
| **Command Line Interface (`greenwash`)** | `packages/cli/src/index.ts`<br>`packages/cli/test/cli.test.ts` | **Working** | `greenwash check` and `greenwash demo` work directly against fixtures and diffs. Exit codes: 0 for PASS/REVIEW, 1 for BLOCKED. Output formats: text, json, markdown, github. |
| **GitHub Actions Step Summary Integration** | `.github/workflows/greenwash.yml`<br>`packages/cli/test/github-workflow.test.ts` | **Working** | Appends formatted Markdown summary directly to `$GITHUB_STEP_SUMMARY`. Tested and verified. |
| **3-Pane Forensic Workbench** | `apps/web/src/components/Workbench.tsx`<br>`apps/web/test/Workbench.test.tsx` | **Working** | Left pane findings, middle pane diff, right pane inspector. Line-synchronized selection and copy-command verified. |
| **Ambient Signal Background** | `apps/web/src/components/AmbientSignalBackground.tsx`<br>`apps/web/test/InteractiveMotion.test.tsx` | **Working** | Canvas-based animated orbital node, radar sweep wave, and subtle telemetry indicators. Responsive to `prefers-reduced-motion`. |
| **Full Report Download Route** | `apps/api/src/server.ts`<br>`apps/web/src/components/Header.tsx` | **Working** | `GET /api/report/download` serves `GREENWASH_FULL_FEATURE_REPORT.md` as an attachment. |

---

## 2. Inconsistencies & Corrections

### 2.1 Five-Step vs. Six-Step Pipeline
- **Claim:** Some UI labels and documentation described the Mastra workflow as a "5-step pipeline".
- **Reality:** In `packages/core/src/mastra/workflow.ts`, the workflow composes **6 explicit steps**:
  1. `validateScenarioDiffStep`
  2. `deterministicScanStep`
  3. `contractReplayStep`
  4. `semanticAnalysisStep`
  5. `normalizeReportStep`
  6. `emitTraceStep`
- **Resolution:** Standardize all UI text, diagrams, and documentation on the **6-step Mastra pipeline**.

### 2.2 Primary Supported Ecosystem: TypeScript / Vitest vs. Python / pytest
- **Claim:** Certain drafts referenced Python and pytest test evasion detection.
- **Reality:** The repository is 100% TypeScript/Node.js. All fixtures (`source.ts`, `test.baseline.ts`, `test.patched.ts`) and test suites use **Vitest**. The only Python references in code are regex skip patterns (`@pytest.mark.skip`).
- **Resolution:** Formally standardize on **TypeScript/JavaScript + Vitest + Node.js** as the primary supported platform. Transparently state that while Python skip decorators can be detected statically via regex, automated test execution and contract replays are currently built for Node.js/Vitest.

### 2.3 "Zero Cloud Egress" Boundary
- **Claim:** Marketing claims previously stated "Zero Cloud Egress" across the platform.
- **Reality:**
  - Local AST analysis, contract replay, and local Gemma inference via Ollama (`localhost:11434`) have **zero cloud egress**.
  - However, when optional external services are configured (`SENTRY_DSN` or `MONGODB_URI`), trace telemetry and persisted audit records exit the machine to Sentry and MongoDB Atlas.
- **Resolution:** Clearly document the privacy boundary: "Local-first by default. Zero cloud egress for local AST analysis, behavior replay, and Ollama Gemma inference. External egress occurs only when optional cloud telemetry (Sentry DSN) or cloud database (MongoDB Atlas) credentials are explicitly configured in `.env`."

### 2.4 "Isolated Runtime" / Subprocess Sandbox
- **Claim:** Status bars and documentation referred to an "Isolated Subprocess Sandbox".
- **Reality:** `packages/core/src/replay/runner.ts` executes code via Node.js `child_process.fork()` with execution timeouts (3000ms default) and output buffers capped at 1MB. This is a separate Node process with IPC, but **not an OS-level microVM, Docker container, or seccomp jail**.
- **Resolution:** Accurately label this as a **"Subprocess Runner (Timeout & Output Bounded)"**. In the public demo, execution is strictly restricted to allow-listed, bundled fixtures (`ALLOWED_SCENARIO_IDS`) to ensure host safety.

### 2.5 Integration Status Badges
- **Claim:** Badges should not claim "Connected" simply because a placeholder or sample exists.
- **Reality:**
  - Gemma: Tested via `GET /api/gemma/check` against real Ollama. Returns `connected: true` only if Ollama `/api/tags` responds HTTP 200.
  - Sentry: Displays `NOT_CONFIGURED` when DSN is absent. Only displays `Configured` when a valid DSN is provided and verified via test span.
  - Entire CLI: Displays `Sample-Only` by default because it reads a checked-in sample dataset (`fixtures/provenance/entire-session.json`). Only reports live when `ENTIRE_SESSION_PATH` points to a live file.
  - MongoDB Atlas: Displays `In-Memory` when unset; displays `Connected` only when a live ping and canary write probe succeeds against Atlas.
- **Resolution:** Preserve and enforce these honest status badges across all screens.

### 2.6 Rule Counts & Test Totals
- **Claim:** Occasional mentions of "14 rules registered".
- **Reality:** There are **6 core AST rule classes** registered in `DeterministicDiffScanner`:
  1. `AssertionWeakeningRule` (`AST-ASSERT-WEAKENED`)
  2. `TestDeletionRule` (`AST-TEST-DELETED`)
  3. `TestSkippingRule` (`AST-TEST-SKIPPED`)
  4. `MockSubstitutionRule` (`AST-MOCK-SUBSTITUTION`)
  5. `CiGateWeakeningRule` (`CI-GATE-SUPPRESSION`, `CI-THRESHOLD-REDUCED`)
  6. `ContractModificationRule` (`CONTRACT-VIOLATION`)
  Plus the `BehaviorReplayRunner` which executes independent contracts (`CONTRACT-VIOLATION` / `CONTRACT-RUNNER-ERROR`). Total distinct rule IDs: **7**.
- **Test Total:** Verified at **184 passing automated tests across 22 test files** using `vitest run`.

---

## 3. Immediate Action Plan

1. **Stage 2:** Verify and lock the `weakened-assertion` hero scenario end-to-end:
   - Contract expects 900, buggy implementation returns 1000, weakened test assertion `toBeGreaterThanOrEqual(0)` passes locally, but independent contract replay fails with expected 900 vs actual 1000.
2. **Stage 3:** Verify and lock the `honest-fix` scenario where implementation returns 900, strict assertion `toBe(900)` is retained, and contract replay passes.
3. **Stage 4:** Verify that one unified `AuditReport` schema powers UI, API, CLI, and downloadable reports with identical findings and reproduction commands.
4. **Stage 5:** Streamline Web UI:
   - Ensure Demo Lab defaults to `weakened-assertion` with explicit "Sample Demonstration" labeling.
   - Synchronize BLOCKED selection immediately to diff line.
   - Ensure PASS screen displays all executed checks, invariant replays, and qualified limitations rather than an empty inspector.
5. **Stage 6:** Ensure Gemma contributes strictly as an advisory analyst without overriding deterministic findings.
6. **Stage 7:** Refine privacy documentation and integration status labels.
7. **Stage 8:** Reorder primary navigation: **Demo Lab**, **Workbench**, **Contracts**, **History**, with secondary access to Pipeline, Timeline, and Integrations.
8. **Stage 9:** Execute full build and test suites, compile `FINAL_VERIFICATION.md`, and update `README.md`.
