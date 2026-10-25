# Graphify Architectural Knowledge Graph Report

**Generated Date:** 2026-10-25T07:56:51.631Z
**Scenario / Workspace:** weakened-assertion
**Total Nodes:** 7
**Total Relationships:** 8
**Identified Communities:** core-domain, billing-community, quality-assurance, security-council, agent-tampering

---

## 1. Executive Summary

Graphify converts GreenWash's AST code modifications, test assertions, and behavioral contracts into a deterministic, queryable knowledge graph. This provides AI coding assistants with architectural memory and pinpoint blast-radius tracking.

- **Tampered Nodes Detected:** 2
- **Downstream Blast Radius:** 3 affected components
- **Primary Compromise Vector:** `AST-ASSERT-WEAKENED`

---

## 2. Graph Node Catalog

| Node ID | Type | Name | Status | Community |
| :--- | :--- | :--- | :---: | :--- |
| `source:weakened-assertion` | `SOURCE_MODULE` | weakened-assertion.ts | **TAMPERED** | core-domain |
| `fn:calculateDiscount` | `FUNCTION` | calculateDiscount(amount, percent) | **VIOLATED** | billing-community |
| `suite:weakened-assertion.test` | `TEST_SUITE` | weakened-assertion.test.ts | **TAMPERED** | quality-assurance |
| `case:discount-calculation-test` | `TEST_CASE` | should calculate 10% discount on 1000 cents | **TAMPERED** | quality-assurance |
| `contract:billing-discount-v1` | `BEHAVIOR_CONTRACT` | Invariant Contract: billing-discount-v1 | **VIOLATED** | security-council |
| `finding:AST-ASSERT-WEAKENED-0` | `AGENT_SESSION` | AST-ASSERT-WEAKENED (critical) | **TAMPERED** | agent-tampering |
| `finding:CONTRACT-VIOLATION-1` | `AGENT_SESSION` | CONTRACT-VIOLATION (critical) | **TAMPERED** | agent-tampering |

---

## 3. Relationship Edges & Dependency Graph

| Source Node | Edge | Target Node | Semantics |
| :--- | :---: | :--- | :--- |
| `source:weakened-assertion` | `--[DECLARES]-->` | `fn:calculateDiscount` | exports function |
| `suite:weakened-assertion.test` | `--[DECLARES]-->` | `case:discount-calculation-test` | defines test |
| `case:discount-calculation-test` | `--[TESTS]-->` | `fn:calculateDiscount` | verifies output |
| `contract:billing-discount-v1` | `--[VERIFIES_INVARIANT]-->` | `fn:calculateDiscount` | enforces [1000, 10] === 900 |
| `finding:AST-ASSERT-WEAKENED-0` | `--[TAMPERED_BY]-->` | `case:discount-calculation-test` | AST-ASSERT-WEAKENED |
| `finding:AST-ASSERT-WEAKENED-0` | `--[DEPENDS_ON]-->` | `fn:calculateDiscount` | compromises logic |
| `finding:CONTRACT-VIOLATION-1` | `--[TAMPERED_BY]-->` | `case:discount-calculation-test` | CONTRACT-VIOLATION |
| `finding:CONTRACT-VIOLATION-1` | `--[DEPENDS_ON]-->` | `fn:calculateDiscount` | compromises logic |

---

## 4. Blast-Radius Analysis

When an agent weakens a test assertion, Graphify traces the full blast radius across dependent contracts and functions:

- **Compromised Functions:** `fn:calculateDiscount`
- **Violated Behavioral Contracts:** `contract:billing-discount-v1`
- **Compromised Test Suites:** `suite:weakened-assertion.test`

---
*Report generated automatically by GreenWash Graphify Engine. Fully compatible with Graphify Knowledge Graph schema.*
