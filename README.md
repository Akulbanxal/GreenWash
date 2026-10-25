# Greenwash

[![Live Demo](https://img.shields.io/badge/Live_Domain-banxal.tech-cyan.svg)](https://banxal.tech)
[![Demo Video](https://img.shields.io/badge/Demo_Video-YouTube-red.svg?logo=youtube)](https://youtu.be/Etl5xBcXUF0)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](file:///Users/akul/Desktop/GreenWash/LICENSE)
[![DigitalOcean App Platform](https://img.shields.io/badge/DigitalOcean-App_Platform_Ready-blue.svg?logo=digitalocean)](file:///Users/akul/Desktop/GreenWash/.do/app.yaml)
[![Open-Weight AI: Gemma 2B](https://img.shields.io/badge/Open--Weight_AI-Gemma_2B%2F7B-purple.svg)](file:///Users/akul/Desktop/GreenWash/docs/open-source-ai.md)
[![Agent Skill](https://img.shields.io/badge/Agent_Skill-greenwash-indigo.svg)](file:///Users/akul/Desktop/GreenWash/skills/greenwash/SKILL.md)
[![Tests Passing](https://img.shields.io/badge/Tests-214_passed-success.svg)](file:///Users/akul/Desktop/GreenWash/packages/)

| 🌐 **Live Web Application** | 📺 **Demo Walkthrough Video** | 🌌 **Interactive Graphify Galaxy** |
|:---:|:---:|:---:|
| [**https://banxal.tech**](https://banxal.tech) | [**Watch on YouTube (youtu.be/Etl5xBcXUF0)**](https://youtu.be/Etl5xBcXUF0) | [**803-Node Knowledge Graph**](https://banxal.tech/graphify.html) |

> **Greenwash catches when an AI coding agent makes tests green by weakening the tests instead of fixing the bug—and shows the exact diff and reproducible evidence.**

Autonomous coding agents often "fix" failing builds by softening assertions (e.g. changing `expect(x).toBe(900)` to `expect(x).toBeGreaterThanOrEqual(0)`), deleting difficult test cases, or stubbing them with mocks. Greenwash pairs deterministic AST diff inspection with independently approved behavioral contracts, open-weight Gemma semantic review, and reproducible replays.

---

## 📺 Video Walkthrough Demo

Watch the complete forensic walkthrough of GreenWash in action—demonstrating real-time detection of softened assertions, ground-truth behavioral contract replays, and interactive exploration of the 803-node Graphify knowledge constellation:

[![Watch GreenWash Demo Video](https://img.youtube.com/vi/Etl5xBcXUF0/hqdefault.jpg)](https://youtu.be/Etl5xBcXUF0)

▶️ **Click to watch on YouTube:** [https://youtu.be/Etl5xBcXUF0](https://youtu.be/Etl5xBcXUF0)

---

## 🌊 DigitalOcean: Best Open-Source AI Project

GreenWash fully satisfies all three criteria of the **DigitalOcean: Best Open-Source AI Project** track:

1. **Open-Weight AI (Gemma 2B & 7B):** 100% local, self-hosted semantic risk analysis via Ollama/vLLM with zero cloud API keys, zero token fees, and zero code egress. See [`docs/open-source-ai.md`](file:///Users/akul/Desktop/GreenWash/docs/open-source-ai.md).
2. **Autonomous Agent Skill:** Native [`skills/greenwash/SKILL.md`](file:///Users/akul/Desktop/GreenWash/skills/greenwash/SKILL.md) empowering Claude Code, Cursor, GitHub Copilot, and Antigravity to self-audit their git diffs and prevent test-weakening before PRs.
3. **Open-Source Model Harness & Graphify:** 6-stage typed Mastra workflow orchestration paired with an 803-node AST knowledge graph mapping the downstream architectural blast radius of every code change.
4. **DigitalOcean 1-Click Deploy:** Ready for instantaneous deployment on DigitalOcean App Platform via [`.do/app.yaml`](file:///Users/akul/Desktop/GreenWash/.do/app.yaml) or single-droplet Docker Compose.

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/Akulbanxal/GreenWash)



---

## 30-Second Quickstart & Demo

```bash
# 1. Install dependencies
npm install

# 2. Run the full verification suite (214 tests across 28 test files)
npm test

# 3. Audit the weakened-assertion benchmark fixture via CLI (Outputs BLOCKED: expected 900, actual 1000)
npm run greenwash -- demo --scenario weakened-assertion

# 4. Audit the honest-fix benchmark fixture (Outputs PASS: expected 900, actual 900)
npm run greenwash -- demo --scenario honest-fix

# 5. Launch the Forensic Workbench UI & API server
npm run dev
# Open http://localhost:3000 in your browser
```

---

## The Core Problem & Hero Proof

```
Candidate PR / Patch
        │
        ├── 1. Unified Diff Parsing (Git diff AST)
        │
        ├── 2. Deterministic AST Rules
        │      └── Detected: expect(x).toBe(900)  ──►  expect(x).toBeGreaterThanOrEqual(0)
        │           [AST-ASSERT-WEAKENED: CRITICAL]
        │
        ├── 3. Independent Behavioral Contract Replay (contract-discount-v1)
        │      └── Input: calculateDiscount(1000, 10)
        │      └── Expected: 900
        │      └── Actual Output of Patch: 1000
        │           [CONTRACT-VIOLATION: FAILED]
        │
        ├── 4. Gemma 2B Open-Weight Semantic Review (Advisory Only)
        │      └── Explains edge cases; cannot override deterministic findings
        │
        └── 5. Tri-State Verdict Normalization
               └── Result: BLOCKED (Exit code 1)
```

1. **Weakened Assertion Scenario:**
   - Candidate code has a bug: returns `1000` instead of `900`.
   - The developer/agent changed `expect(result).toBe(900)` to `expect(result).toBeGreaterThanOrEqual(0)`.
   - The ordinary test suite passes (green build!).
   - **Greenwash catches it:** Deterministic rule `AST-ASSERT-WEAKENED` flags the softened assertion, while the independent contract replay executes `calculateDiscount(1000, 10)` in a bounded subprocess and catches the discrepancy (`expected: 900, actual: 1000`). Verdict: **`BLOCKED`**.

2. **Honest Fix Scenario:**
   - The function is corrected to return `900`.
   - Strict assertion `toBe(900)` is retained.
   - Independent replay confirms `calculateDiscount(1000, 10) === 900`.
   - Verdict: **`PASS`** with qualified notice: *"No violations detected in supported checks."*

---

## Supported Rule Types

The deterministic engine (`packages/core`) inspects unified diffs using `ts-morph` and Babel AST parsing across 6 core rule categories:

| Rule ID | Severity | Category | What it Detects |
|:---|:---:|:---|:---|
| `AST-ASSERT-WEAKENED` | `critical` | Assertion Weakening | Changing strict equality (`toBe`, `toEqual`) into relational inequality (`>= 0`, `> 0`) or broad existence (`toBeDefined`, `toBeTruthy`). |
| `AST-TEST-DELETED` | `critical` | Test Deletion | Removing `it(...)` or `test(...)` blocks from test files in candidate diffs. |
| `AST-TEST-SKIPPED` | `high` | Test Disablement | Modifying tests into skipped blocks (`it.skip`, `test.skip`, `xit`, `xdescribe`). |
| `AST-MOCK-INJECTED` | `medium` | Mock Substitution | Introducing new mock factories (`vi.mock`, `jest.mock`, `vi.spyOn`) that stub business logic without baseline approval (defaults to `REVIEW`). |
| `CI-GATE-WEAKENED` | `critical` | CI Pipeline Tampering | Suppressing test failures in GitHub Actions workflows (`continue-on-error: true`, `\|\| true`, or lowering coverage thresholds). |
| `CONTRACT-MODIFIED` | `critical` | Contract Tampering | Candidate patches attempting to edit pre-approved behavioral contract definitions in `.greenwash/contracts/`. |
| `CONTRACT-VIOLATION` | `critical` | Behavioral Regression | Independent contract replay returning an output differing from the approved specification. |

---

## How Behavior Contracts Work

Contracts are immutable specifications stored outside candidate pull requests (in `packages/core/fixtures/contracts/` or `.greenwash/contracts/`):

```json
{
  "id": "contract-discount-v1",
  "version": "1.0.0",
  "targetFile": "src/discount.ts",
  "targetFunction": "calculateDiscount",
  "invariants": [
    {
      "id": "inv-std-discount",
      "description": "Standard 10% discount on 1000 cents",
      "args": [1000, 10],
      "expected": 900
    }
  ]
}
```

- When an audit runs, candidate patches cannot modify the contract used for their evaluation.
- The replayer imports the candidate implementation into an isolated subprocess with bounded memory and execution time.
- If the return value does not match `expected`, Greenwash flags a `CONTRACT-VIOLATION` regardless of what unit tests claim.

---

## Role of Gemma & Safety Boundaries

Greenwash leverages **Gemma 2 2B / 7B** via local Ollama (`http://localhost:11434`):
- **Advisory Only:** Gemma provides natural language explanations of ambiguous test changes, impact summaries, and candidate edge-case questions.
- **Untrusted Output:** Model output is strictly validated against `GemmaReviewResponseSchema`.
- **Zero Override Authority:** Gemma **never** removes a deterministic finding, lowers a severity verdict, or changes `BLOCKED` to `PASS`.
- **Factual Offline State:** If Ollama or Gemma is not running, Greenwash displays an honest "Offline / Unconfigured" state and deterministic checks continue uninterrupted.
- **Zero Cloud Egress:** Gemma runs locally on your machine. No source code is sent to third-party proprietary APIs.

---

## Data & Privacy Boundaries

- **Local-First Default:** All AST analysis, unified diff parsing, and contract replays happen locally in your Node.js environment.
- **Subprocess Runner Boundary:** Replays execute in child processes with 5000ms timeouts, 128MB memory caps, and sanitized environment variables. (This is a process runner, not an OS-level microVM).
- **External Services (Honest Status):**
  - **Sentry:** Spans are captured only if `SENTRY_DSN` is explicitly provided. When unconfigured, the UI shows "Disconnected" and zero network calls occur.
  - **MongoDB Atlas:** Run history is persisted to Atlas only if `MONGODB_URI` is provided; otherwise, Greenwash transparently runs in local in-memory storage mode.
  - **Entire:** Analyzes local CLI session files and `.entire` event logs.

---

## Primary Product Architecture

The user interface is structured around 4 primary workflows and secondary diagnostics:

1. **Demo Lab (`apps/web`):** Interactive scenario runner loaded with sample benchmark data demonstrating weakened assertions and clean fixes.
2. **Forensic Workbench:** 3-pane layout with file navigation, unified syntax-highlighted diffs, and evidence inspector synchronized to changed lines.
3. **Contracts Explorer:** Approved baseline invariants and replay execution results.
4. **History & Reports:** Measured run durations, persistent audit records, and downloadable Markdown/JSON reports.
5. **Diagnostics:** Mastra 6-stage pipeline traces, Entire timeline checkpoints, and integration health probes.

---

## Reproducible Testing

Greenwash includes comprehensive automated test suites:

```bash
# Run all 214 tests across 28 test files
npm test

# Run core AST rules tests
npm test packages/core/test/rules.test.ts

# Run contract replay tests
npm test packages/core/test/replay.test.ts

# Run HTTP API integration tests
npm test apps/api/test/api.test.ts

# Run Web UI component tests
npm test apps/web/test/
```

---

## Competition Tracks Matrix

| Competition Track | Module / Location | Status | Implementation Details |
|:---|:---|:---:|:---|
| **DigitalOcean: Best Open-Source AI Project** | [`.do/app.yaml`](file:///Users/akul/Desktop/GreenWash/.do/app.yaml), [`skills/greenwash/`](file:///Users/akul/Desktop/GreenWash/skills/greenwash/), [`docs/open-source-ai.md`](file:///Users/akul/Desktop/GreenWash/docs/open-source-ai.md) | Verified Live | MIT-licensed open-source AI project using open-weight Gemma 2B/7B, native agent skill for coding assistants, 6-stage Mastra workflow harness, and 1-click DigitalOcean App Platform spec. |
| **Best Use of Gemma** ($200) | [`packages/core/src/gemma/`](file:///packages/core/src/gemma/) | Verified Live | Local Ollama endpoint (`http://localhost:11434`), structured schema review, zero secret leakage, strictly advisory (never overrides deterministic rules). |
| **Best Use of Mastra** ($100) | [`packages/core/src/mastra/`](file:///packages/core/src/mastra/) | Active | 6-stage typed audit workflow pipeline orchestrating AST diff checks, behavior replay, Gemma advisory, and verdict calculation. |
| **Best Use of Entire** ($100) | [`packages/core/src/provenance/`](file:///packages/core/src/provenance/) | Verified Live | Real-time session watcher and parser for Entire CLI agent provenance trails with automatic secret redaction engine (`[REDACTED_SECRET]`) and suspicious sequence detection. |
| **Best Use of Sentry Agent Tracing** ($100) | [`packages/core/src/sentry/`](file:///packages/core/src/sentry/) | Verified Live | OpenTelemetry / Sentry distributed agent tracing with child spans for every audit step, live verification probe, and sanitized payloads. |
| **Best Use of MongoDB Atlas** ($100) | [`packages/core/src/persistence/`](file:///packages/core/src/persistence/) | Verified Live | Dual-mode audit history repository supporting MongoDB Atlas with live canary write/read probe (14ms latency) and transparent in-memory local fallback. |
| **Best Use of Render** | [`render.yaml`](file:///Users/akul/Desktop/GreenWash/render.yaml), [`Dockerfile`](file:///Users/akul/Desktop/GreenWash/Dockerfile) | Live on Render | Unified single-port deployment on Render Free Tier serving Express API + static Vite bundle with automated continuous deployment. |
| **Best Use of a .tech Domain** | [`https://banxal.tech`](https://banxal.tech) | Live Domain | Custom `.tech` domain connected via DNS CNAME records to Render production deployment with automated SSL/TLS encryption. |
| **Graphify Knowledge Graph Integration** | [`packages/core/src/graphify/`](file:///packages/core/src/graphify/), [`apps/web/src/components/GraphifyVisualizer.tsx`](file:///apps/web/src/components/GraphifyVisualizer.tsx) | Live Integration | 803-node, 1,876-edge, 39-community interactive vis-network constellation graph and forensic blast-radius DAG visualizer. |

---

## Honest Technical Limitations

- **Syntax Support:** Tailored for JavaScript / TypeScript (Vitest / Jest), Python / pytest, and GitHub Actions CI YAML.
- **Contract Boundary:** Contracts verify specific input/output invariants; they do not perform formal verification or symbolic execution of arbitrary algorithms.
- **Process Isolation:** Fixture replays use timeout-bounded Node subprocesses. Untrusted arbitrary repository code should not be executed without containerized isolation.
