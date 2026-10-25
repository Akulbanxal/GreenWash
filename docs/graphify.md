# GreenWash & Graphify Integration Guide

## Overview

**Graphify** transforms codebases into queryable, deterministic AST-based knowledge graphs, providing AI coding assistants with architectural memory and relationships without burning context-window tokens.

**GreenWash** pairs with Graphify to map the **architectural blast radius of AI test-greenwashing**:
When an autonomous agent softens or deletes a test assertion (e.g. changing `expect(x).toBe(900)` to `>= 0`), GreenWash uses Graphify to trace the downstream blast radius—identifying which exported business functions, dependent integration test suites, and immutable behavior contracts are compromised.

---

## Key Capabilities

1. **Deterministic AST Knowledge Graph:**
   - Extracts `SOURCE_MODULE`, `FUNCTION`, `TEST_SUITE`, `TEST_CASE`, and `BEHAVIOR_CONTRACT` nodes.
   - Maps explicit semantic edges: `DECLARES`, `TESTS`, `VERIFIES_INVARIANT`, `TAMPERED_BY`, and `DEPENDS_ON`.
2. **Blast-Radius Traversal:**
   - Pinpoints how a local test edit silently compromises distant system contracts and production invariants.
3. **Graphify Standards Compatibility:**
   - Automatically exports standard `graphify-out/graph.json` and a comprehensive `graphify-out/GRAPH_REPORT.md`.
4. **Interactive UI Visualizer:**
   - Built into the GreenWash Workbench UI under the **"Graphify"** diagnostic tab.

---

## CLI Usage

Generate Graphify knowledge graph artifacts from the command line:

```bash
# Generate knowledge graph and blast radius for the hero scenario
npm run greenwash -- graphify --scenario weakened-assertion

# Custom output directory
npm run greenwash -- graphify --scenario honest-fix --output ./custom-graphify-out
```

---

## REST API Endpoint

```http
GET /api/graphify/:scenarioId?
```

Returns the full JSON knowledge graph with nodes, edges, community clusters, and blast-radius tracking.
