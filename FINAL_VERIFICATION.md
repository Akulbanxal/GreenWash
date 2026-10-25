# Greenwash — Final Technical Verification & Reality Report

**Verification Date:** 2026-10-23  
**Platform:** Node.js v22.23.1, TypeScript 5.5.4, Vitest v2.1.8, React 18, Vite 5.4  
**Primary Supported Ecosystem:** TypeScript / JavaScript + Vitest + Node.js  

---

## 1. Executive Summary: The Hero Proof

Greenwash catches when an AI agent makes tests green by weakening the tests instead of fixing the underlying bug.

### Hero Scenario A — The Deceptive Green Build (`weakened-assertion`)
- **Code Defect:** In `src/discount.ts`, an incorrect calculation returns `1000` instead of `900`.
- **The Tampered Test:** The unit test in `tests/discount.test.ts` was weakened from `expect(discounted).toBe(900);` to `expect(discounted).toBeGreaterThanOrEqual(0);`.
- **The Ordinary Suite:** The softened test passes locally, falsely claiming the build is green.
- **Greenwash Reality:**
  1. AST scanner detects exact assertion weakening (`AST-ASSERT-WEAKENED`, severity `critical`).
  2. Independent behavioral contract (`contract-discount-v1`) was preserved outside the patch.
  3. Contract replayer executes `calculateDiscount(1000, 10)` in a clean subprocess:
     - **Expected:** `900`
     - **Actual:** `1000`
     - **Replay Status:** `FAILED`
  4. Aggregate Verdict: **`BLOCKED`** with exact diff hunk, synchronized line numbers, and copyable reproduction command.

### Hero Scenario B — The Honest Bug Fix (`honest-fix`)
- **Correction:** `src/discount.ts` is corrected to return `900`.
- **The Test:** Strict assertion `expect(discounted).toBe(900);` is retained.
- **Greenwash Reality:**
  1. AST scanner detects 0 violations.
  2. Protected contract replay passes (`expected: 900, actual: 900`).
  3. Aggregate Verdict: **`PASS`** with qualified statement: *"No violations detected in supported checks."* (Never claimed to prove arbitrary code safe).

---

## 2. Automated Test & Build Execution Matrix

### 2.1 Workspace Full Test Suite
**Command:** `node ./node_modules/vitest/vitest.mjs run`  
**Result:** **28 Test Files Passed (100%), 214 Tests Passed (100%), 0 Failures**

| Test File | Category | Tests Passed | Status |
|:---|:---|:---:|:---:|
| `packages/core/test/rules.test.ts` | Deterministic AST Rules (Weakened assertions, deleted tests, skipped tests, mocks, CI gates) | 17 / 17 | PASSED |
| `packages/core/test/python-rules.test.ts` | Python & Pytest Integrity Rules (`PY-ASSERT-WEAKENED`, skipped marks, test deletion) | 4 / 4 | PASSED |
| `packages/core/test/contract-synthesizer.test.ts` | Dynamic Behavior Contract Synthesizer (Heuristic extraction from tests/specs) | 3 / 3 | PASSED |
| `packages/core/test/provenance-watcher.test.ts` | EntireSessionWatcher (Live agent session tailing & streaming simulation) | 2 / 2 | PASSED |
| `packages/core/test/replay.test.ts` | Independent Behavioral Contract Replay (Subprocess execution, 900 vs 1000) | 7 / 7 | PASSED |
| `packages/core/test/fixtures.test.ts` | Benchmark Fixtures & Diff Integrity | 7 / 7 | PASSED |
| `packages/core/test/schemas.test.ts` | Zod Schemas & Contract Type Boundaries | 14 / 14 | PASSED |
| `packages/core/test/mastra-workflow.test.ts` | 6-Stage Orchestrated Mastra Workflow Pipeline | 10 / 10 | PASSED |
| `packages/core/test/gemma.test.ts` | Gemma Reviewer & Fallback Resiliency | 9 / 9 | PASSED |
| `packages/core/test/sentry-tracing.test.ts` | OpenTelemetry / Sentry Trace Instrumentation | 7 / 7 | PASSED |
| `packages/core/test/provenance.test.ts` | Entire CLI Provenance & Cryptographic Run Hashes | 8 / 8 | PASSED |
| `packages/core/test/mongodb-persistence.test.ts` | Dual-mode Run Storage (In-memory + Atlas client) | 20 / 20 | PASSED |
| `packages/core/test/core.test.ts` | Core Engine Entry & Public API exports | 2 / 2 | PASSED |
| `packages/cli/test/cli.test.ts` | CLI Check, Demo, Test-Mongo, Synthesize, Stream-Provenance Subcommands | 3 / 3 | PASSED |
| `packages/cli/test/github-workflow.test.ts` | GitHub Step Summary & CI Annotations | 10 / 10 | PASSED |
| `apps/api/test/api.test.ts` | Express HTTP API (Synthesize, Session stream, Probes) | 21 / 21 | PASSED |
| `apps/web/test/App.test.tsx` | App Shell, Navigation Routing & Command Palette | 6 / 6 | PASSED |
| `apps/web/test/DemoLab.test.tsx` | Demo Lab Scenario Selection & Real Audit Runner | 7 / 7 | PASSED |
| `apps/web/test/Workbench.test.tsx` | 3-Pane Workbench & Finding-to-Diff Synchronization | 6 / 6 | PASSED |
| `apps/web/test/ContractAndTimeline.test.tsx` | Contracts Explorer, Contract Synthesis & Timeline Streaming | 5 / 5 | PASSED |
| `apps/web/test/WorkflowDetails.test.tsx` | 6-Stage Pipeline Details & Execution Traces | 6 / 6 | PASSED |
| `apps/web/test/HistoryView.test.tsx` | Audit History & Storage Diagnostics | 7 / 7 | PASSED |
| `apps/web/test/GemmaReview.test.tsx` | Gemma Review UI & Advisory Callouts | 5 / 5 | PASSED |
| `apps/web/test/SentryDiagnostics.test.tsx` | Sentry Status & Honest Diagnostic Probes | 5 / 5 | PASSED |
| `apps/web/test/InteractiveMotion.test.tsx` | Ambient Background, Motion, & Command Palette | 5 / 5 | PASSED |
| `apps/web/test/LandingPage.test.tsx` | Cinematic Landing Page & Interactive Audit Walkthrough | 8 / 8 | PASSED |
| `apps/web/test/ThemeAndMotion.test.tsx` | Theme Switching & Canvas Signal Background | 5 / 5 | PASSED |
| `apps/web/test/useScrollToResult.test.tsx` | Smooth Auto-Scroll & Accessible Focus | 5 / 5 | PASSED |
| **Total** | **All Workspaces** | **214 / 214** | **100% PASS** |

### 2.2 Production Build
**Command:** `npm run build`  
**Result:** **SUCCESS (0 errors)**  
- `@greenwash/core`: TypeScript compilation clean (`dist/index.js`, `dist/browser.js`)
- `@greenwash/cli`: TypeScript compilation clean (`dist/index.js`)
- `@greenwash/api`: TypeScript compilation clean (`dist/server.js`)
- `@greenwash/web`: TypeScript typecheck clean + Vite production bundle (`dist/index.html`)

### 2.3 CLI Direct Invocations
- `node ./packages/cli/dist/index.js demo --scenario weakened-assertion`  
  **Exit Code:** `1` (BLOCKED)  
  **Findings:** `AST-ASSERT-WEAKENED` (critical) + `CONTRACT-VIOLATION` (expected: 900, actual: 1000).
- `node ./packages/cli/dist/index.js demo --scenario honest-fix`  
  **Exit Code:** `0` (PASS)  
  **Findings:** `0`. All 8 checks passed.

---

## 3. Integrations Status & Truthful Verification

| Subsystem | Configuration Requirement | Verified Behavior | Production Classification |
|:---|:---|:---|:---|
| **Local Gemma 2B** | Ollama running locally at `http://localhost:11434` with `gemma:2b` | Verified live HTTP response across all 12 scenario findings. Generates structured JSON adhering to `GemmaReviewResponseSchema`. Redacts secrets before prompting. Output labeled advisory only; never overrides deterministic findings. | **Verified Live** (When Ollama is running) / **Factual Offline State** (When absent) |
| **Entire CLI** | Local file log trail / `.entire` sessions | Verified session replay parser with timestamp tracking and cryptographic run hashing (`sha256:4f8e...`). | **Verified Local File / Sample Session** |
| **Mastra Pipeline** | None (Built-in deterministic orchestrator) | 6-stage typed execution pipeline (`diff-validation`, `ast-rules`, `contract-replay`, `gemma-advisory`, `normalization`, `persistence`). Emits real progress events. | **Verified Engine Core** |
| **Sentry Telemetry** | `SENTRY_DSN` environment variable | If unset: UI displays "Disconnected (Local Mode)", verification probe returns `{ configured: false }`. If set: captures spans for pipeline stages without sending source code. | **Verified Honest State** (Safe Local Fallback) |
| **MongoDB Atlas** | `MONGODB_URI` environment variable | If unset: UI displays "In-Memory Local Mode", verification probe returns `{ connected: false, mode: "in-memory" }`. Dual-mode repository passes 20/20 tests. | **Verified Dual Mode** (Safe In-Memory Fallback) |

---

## 4. Honest Technical Limitations

1. **Parser Syntax Scope:**  
   The AST scanner uses `ts-morph` / Babel to analyze unified Git diffs. It specifically inspects:
   - Vitest / Jest assertions: `expect(...).toBe(...)`, `toEqual(...)`, relational comparisons (`toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeDefined`).
   - Vitest / Jest test blocks: `describe`, `it`, `test`, `it.skip`, `test.skip`, `xit`.
   - Mocking APIs: `vi.mock(...)`, `vi.spyOn(...)`, `jest.mock(...)`.
   - CI Workflows: GitHub Actions YAML keys (`continue-on-error`, `|| true`, coverage thresholds).
   It does not perform whole-program static analysis or symbolic execution.
2. **Behavior Contracts:**  
   Contracts evaluate pre-approved canonical test cases against exported JavaScript/TypeScript functions. They prove that specific invariant inputs produce expected outputs. They do not constitute formal verification of arbitrary algorithms.
3. **Subprocess Execution Boundary:**  
   Contract replay runs fixtures using `child_process.fork` / `execFile` with bounded timeouts (5000ms), bounded memory (128MB), and sanitized environment variables. It is not an OS-level virtualized microVM sandbox. The public demo restricts execution to known, allow-listed benchmark fixtures.
4. **Data Privacy:**  
   Greenwash operates entirely locally by default. No code, diffs, or file contents leave your machine. Gemma inference runs on your local Ollama daemon. Cloud egress occurs only if you explicitly provide an external Sentry DSN or MongoDB Atlas connection string.
