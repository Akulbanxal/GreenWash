# DigitalOcean: Best Open-Source AI Project Track Specification

## Overview

**GreenWash** is an open-source, local-first integrity verification harness and agent skill designed to detect, block, and visualize **AI test-greenwashing**—the insidious failure mode where autonomous coding agents secretly soften assertions, delete tests, skip suites, or insert synthetic mocks to manufacture false "green" CI builds.

GreenWash is built under the **MIT License** and utilizes 100% open-source and open-weight AI technologies with zero proprietary cloud vendor lock-in.

---

## 3 Core Open-Source AI Pillars Satisfied

The DigitalOcean Hacktoberfest track highlights three avenues for open-source AI:
1. **Open-Weight Large/Small Language Models (Gemma 2B & 7B)**
2. **Autonomous Agent Skills (`skills/greenwash/SKILL.md`)**
3. **Open-Source Model Harnesses (Mastra + Ollama + Graphify)**

GreenWash delivers across all three pillars:

---

### Pillar 1: Open-Weight AI (Gemma 2 2B & 7B)

Instead of relying on proprietary cloud APIs that egress confidential codebase code, GreenWash integrates **Google's open-weight Gemma 2 model family** (`gemma:2b` and `gemma:7b`) via local, self-hosted inference runtimes (Ollama, vLLM, or Hugging Face TGI).

- **Implementation:** [`packages/core/src/gemma/GemmaSemanticReviewer.ts`](file:///Users/akul/Desktop/GreenWash/packages/core/src/gemma/GemmaSemanticReviewer.ts)
- **Role in Pipeline:**
  - Evaluates semantic intent between PR diffs and docstrings.
  - Identifies vacuous assertion replacements that pass syntactic checks but destroy invariant semantics.
  - Generates adversarial edge-case inputs to stress-test candidate fixes.
- **Privacy & Security:** 100% local inference with bounded timeouts, secret redaction (`redactSecrets`), and zero token egress.

```bash
# Pull and run Gemma locally via Ollama
ollama run gemma:2b

# Configure GreenWash to use local open-weight Gemma
export GEMMA_ENDPOINT="http://localhost:11434"
export GEMMA_MODEL="gemma:2b"
```

---

### Pillar 2: Native Agent Skill (`skills/greenwash/SKILL.md`)

GreenWash ships with a standardized **Agent Skill** compatible with modern autonomous agent platforms, including:
- **Claude Code** (`CLAUDE.md` / PreToolUse hooks)
- **Cursor** (`.cursor/rules/`)
- **GitHub Copilot CLI & VS Code** (`.github/copilot-instructions.md`)
- **Google Antigravity** (`.agents/skills/greenwash/`)
- **Aider & OpenCode** (`AGENTS.md`)

#### How Coding Agents Use the Skill:
Autonomous agents are instructed to run GreenWash prior to committing code:
```bash
git diff HEAD | npx greenwash audit --diff -
```
If an agent has inadvertently weakened an assertion or skipped a test to make a task pass, GreenWash returns `status: BLOCKED` with line-level AST evidence, forcing the agent to revert the tampering and correctly fix the underlying business logic.

---

### Pillar 3: Open-Source Model Harness & Graphify Knowledge Engine

GreenWash integrates an open-source model harness ecosystem:
1. **Mastra Workflow Orchestration (`@mastra/core`):**
   - 6-stage typed state machine coordinating static AST scanning, contract verification, open-weight Gemma review, Sentry agent telemetry, and MongoDB persistence.
2. **Graphify AST Knowledge Graph (`Graphify-Labs/graphify`):**
   - Extracts 803 nodes, 1,876 edges, and 39 Leiden algorithmic communities across the monorepo.
   - Computes the topological blast radius when an assertion is modified, tracing which downstream business functions and invariant contracts are affected.

---

## 🌊 DigitalOcean Deployment Architecture

GreenWash is engineered for rapid 1-click deployment on **DigitalOcean App Platform** or **DigitalOcean Droplets**.

### Option A: 1-Click DigitalOcean App Platform Deploy

Deploy directly using the included DigitalOcean App specification ([`.do/app.yaml`](file:///Users/akul/Desktop/GreenWash/.do/app.yaml)):

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/Akulbanxal/GreenWash)

```bash
# Or deploy using the DigitalOcean CLI (doctl)
doctl apps create --spec .do/app.yaml
```

### Option B: DigitalOcean Droplet (Docker Compose)

Deploy GreenWash + MongoDB on a single DigitalOcean basic Droplet ($4/mo or $6/mo):

```bash
# 1. SSH into your DigitalOcean Droplet
ssh root@your-droplet-ip

# 2. Clone repository and start container stack
git clone https://github.com/Akulbanxal/GreenWash.git
cd GreenWash
docker compose up -d --build

# 3. Access GreenWash
# Workbench UI: http://your-droplet-ip:3001
# Graphify Visualizer: http://your-droplet-ip:3001/graphify.html
```

---

## License

GreenWash is licensed under the **[MIT License](file:///Users/akul/Desktop/GreenWash/LICENSE)**, ensuring complete freedom for academic research, commercial integration, and community contributions.
