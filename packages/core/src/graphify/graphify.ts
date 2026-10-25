import fs from "node:fs";
import path from "node:path";
import { GraphifyEdge, GraphifyGraph, GraphifyNode } from "./types.js";
import { AuditFinding, AuditReport } from "../domain/schemas.js";

export class GraphifyEngine {
  /**
   * Builds an architectural knowledge graph for a scenario or audit report.
   * Identifies relationships between source code, test assertions, contracts, and tampering blast radius.
   */
  generateScenarioGraph(
    scenarioId: string,
    report?: AuditReport,
    customDiff?: string
  ): GraphifyGraph {
    const nodes: GraphifyNode[] = [];
    const edges: GraphifyEdge[] = [];

    // 1. Source Module Node
    const sourceNodeId = `source:${scenarioId}`;
    nodes.push({
      id: sourceNodeId,
      name: `${scenarioId}.ts`,
      type: "SOURCE_MODULE",
      filePath: `src/${scenarioId}.ts`,
      community: "core-domain",
      status: report?.status === "BLOCKED" ? "tampered" : "intact",
    });

    // 2. Business Function Node
    const funcNodeId = `fn:calculateDiscount`;
    nodes.push({
      id: funcNodeId,
      name: "calculateDiscount(amount, percent)",
      type: "FUNCTION",
      filePath: `src/${scenarioId}.ts`,
      lineStart: 1,
      lineEnd: 15,
      community: "billing-community",
      status: report?.status === "BLOCKED" ? "violated" : "verified",
      metadata: {
        expectedReturn: 900,
        actualReturn: report?.status === "BLOCKED" ? 1000 : 900,
      },
    });

    edges.push({
      id: `edge:${sourceNodeId}->${funcNodeId}`,
      source: sourceNodeId,
      target: funcNodeId,
      relation: "DECLARES",
      label: "exports function",
    });

    // 3. Test Suite Node
    const testSuiteId = `suite:${scenarioId}.test`;
    nodes.push({
      id: testSuiteId,
      name: `${scenarioId}.test.ts`,
      type: "TEST_SUITE",
      filePath: `tests/${scenarioId}.test.ts`,
      community: "quality-assurance",
      status: report?.findings && report.findings.length > 0 ? "tampered" : "intact",
    });

    // 4. Test Case Node
    const testCaseId = `case:discount-calculation-test`;
    nodes.push({
      id: testCaseId,
      name: "should calculate 10% discount on 1000 cents",
      type: "TEST_CASE",
      filePath: `tests/${scenarioId}.test.ts`,
      lineStart: 5,
      lineEnd: 12,
      community: "quality-assurance",
      status: report?.findings && report.findings.length > 0 ? "tampered" : "verified",
      metadata: {
        assertion: report?.status === "BLOCKED" ? "toBeGreaterThanOrEqual(0)" : "toBe(900)",
      },
    });

    edges.push({
      id: `edge:${testSuiteId}->${testCaseId}`,
      source: testSuiteId,
      target: testCaseId,
      relation: "DECLARES",
      label: "defines test",
    });

    edges.push({
      id: `edge:${testCaseId}->${funcNodeId}`,
      source: testCaseId,
      target: funcNodeId,
      relation: "TESTS",
      label: "verifies output",
    });

    // 5. Behavior Contract Node
    const contractNodeId = `contract:billing-discount-v1`;
    nodes.push({
      id: contractNodeId,
      name: "Invariant Contract: billing-discount-v1",
      type: "BEHAVIOR_CONTRACT",
      filePath: "fixtures/contracts/billing-discount.contract.json",
      community: "security-council",
      status: report?.status === "BLOCKED" ? "violated" : "verified",
      metadata: {
        immutable: true,
        expectedResult: 900,
      },
    });

    edges.push({
      id: `edge:${contractNodeId}->${funcNodeId}`,
      source: contractNodeId,
      target: funcNodeId,
      relation: "VERIFIES_INVARIANT",
      label: "enforces [1000, 10] === 900",
    });

    // 6. Agent Session / Tampering Nodes if findings exist
    let tamperedCount = 0;
    const affectedFunctions: string[] = [];
    const affectedContracts: string[] = [];
    const affectedSuites: string[] = [];

    if (report?.findings && report.findings.length > 0) {
      report.findings.forEach((finding: AuditFinding, idx: number) => {
        const findingNodeId = `finding:${finding.ruleId}-${idx}`;
        const firstEvidence = finding.evidence?.[0];
        nodes.push({
          id: findingNodeId,
          name: `${finding.ruleId} (${finding.severity})`,
          type: "AGENT_SESSION",
          filePath: firstEvidence?.filePath || `src/${scenarioId}.ts`,
          lineStart: firstEvidence?.startLine,
          lineEnd: firstEvidence?.endLine,
          community: "agent-tampering",
          status: "tampered",
          metadata: {
            title: finding.title,
            description: finding.summary,
            reproductionCommand: finding.reproductionCommand,
          },
        });

        edges.push({
          id: `edge:${findingNodeId}->${testCaseId}`,
          source: findingNodeId,
          target: testCaseId,
          relation: "TAMPERED_BY",
          label: finding.ruleId,
        });

        edges.push({
          id: `edge:${findingNodeId}->${funcNodeId}`,
          source: findingNodeId,
          target: funcNodeId,
          relation: "DEPENDS_ON",
          label: "compromises logic",
        });

        tamperedCount++;
      });

      affectedFunctions.push(funcNodeId);
      affectedContracts.push(contractNodeId);
      affectedSuites.push(testSuiteId);
    }

    const communities = Array.from(new Set(nodes.map((n) => n.community)));

    return {
      scenarioId,
      generatedAt: new Date().toISOString(),
      nodes,
      edges,
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        tamperedNodes: tamperedCount,
        communities,
        blastRadiusCount: affectedFunctions.length + affectedContracts.length + affectedSuites.length,
      },
      blastRadius: {
        sourceTamperingId: report?.findings?.[0]?.ruleId || "NONE",
        affectedFunctions,
        affectedContracts,
        affectedSuites,
      },
    };
  }

  /**
   * Exports standard Graphify artifacts (graph.json and GRAPH_REPORT.md).
   */
  exportGraphifyArtifacts(graph: GraphifyGraph, outputDir: string = "graphify-out"): {
    jsonPath: string;
    reportPath: string;
  } {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonPath = path.join(outputDir, "graph.json");
    fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2), "utf-8");

    const reportContent = `# Graphify Architectural Knowledge Graph Report

**Generated Date:** ${graph.generatedAt}
**Scenario / Workspace:** ${graph.scenarioId || "default"}
**Total Nodes:** ${graph.summary.totalNodes}
**Total Relationships:** ${graph.summary.totalEdges}
**Identified Communities:** ${graph.summary.communities.join(", ")}

---

## 1. Executive Summary

Graphify converts GreenWash's AST code modifications, test assertions, and behavioral contracts into a deterministic, queryable knowledge graph. This provides AI coding assistants with architectural memory and pinpoint blast-radius tracking.

- **Tampered Nodes Detected:** ${graph.summary.tamperedNodes}
- **Downstream Blast Radius:** ${graph.summary.blastRadiusCount} affected components
- **Primary Compromise Vector:** \`${graph.blastRadius.sourceTamperingId}\`

---

## 2. Graph Node Catalog

| Node ID | Type | Name | Status | Community |
| :--- | :--- | :--- | :---: | :--- |
${graph.nodes.map((n) => `| \`${n.id}\` | \`${n.type}\` | ${n.name} | **${n.status.toUpperCase()}** | ${n.community} |`).join("\n")}

---

## 3. Relationship Edges & Dependency Graph

| Source Node | Edge | Target Node | Semantics |
| :--- | :---: | :--- | :--- |
${graph.edges.map((e) => `| \`${e.source}\` | \`--[${e.relation}]-->\` | \`${e.target}\` | ${e.label || ""} |`).join("\n")}

---

## 4. Blast-Radius Analysis

When an agent weakens a test assertion, Graphify traces the full blast radius across dependent contracts and functions:

- **Compromised Functions:** ${graph.blastRadius.affectedFunctions.length > 0 ? graph.blastRadius.affectedFunctions.map((f) => `\`${f}\``).join(", ") : "None (Intact)"}
- **Violated Behavioral Contracts:** ${graph.blastRadius.affectedContracts.length > 0 ? graph.blastRadius.affectedContracts.map((c) => `\`${c}\``).join(", ") : "None (Intact)"}
- **Compromised Test Suites:** ${graph.blastRadius.affectedSuites.length > 0 ? graph.blastRadius.affectedSuites.map((s) => `\`${s}\``).join(", ") : "None (Intact)"}

---
*Report generated automatically by GreenWash Graphify Engine. Fully compatible with Graphify Knowledge Graph schema.*
`;

    const reportPath = path.join(outputDir, "GRAPH_REPORT.md");
    fs.writeFileSync(reportPath, reportContent, "utf-8");

    return { jsonPath, reportPath };
  }
}

export const globalGraphifyEngine = new GraphifyEngine();
