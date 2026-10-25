import fs from "node:fs";
import path from "node:path";
import {
  AuditReport,
  AuditReportSchema,
  AuditSummary,
  AuditSummarySchema,
} from "./domain/schemas.js";
import { computeAuditStatus } from "./domain/status.js";
import { DeterministicDiffScanner } from "./rules/scanner.js";
import { BehaviorReplayRunner } from "./replay/runner.js";
import { getScenarioById, isAllowedScenarioId, resolveFixturePath } from "./fixtures/loader.js";
import {
  runAuditPipeline,
  RunAuditPipelineParams,
  MastraAuditWorkflowResult,
} from "./mastra/index.js";
import { traceAuditStep } from "./sentry/index.js";

import {
  AuditRepository,
  getGlobalAuditRepository,
  PersistedAuditRecord,
} from "./persistence/index.js";

export interface AuditEngineOptions {
  scanner?: DeterministicDiffScanner;
  replayRunner?: BehaviorReplayRunner;
  repository?: AuditRepository;
}

export class GreenwashEngine {
  private readonly scanner: DeterministicDiffScanner;
  private readonly replayRunner: BehaviorReplayRunner;
  private readonly explicitRepository?: AuditRepository;
  private readonly reportStore = new Map<string, AuditReport>();

  constructor(options?: AuditEngineOptions) {
    this.scanner = options?.scanner ?? new DeterministicDiffScanner();
    this.replayRunner = options?.replayRunner ?? new BehaviorReplayRunner();
    this.explicitRepository = options?.repository;
  }

  get repository(): AuditRepository {
    return this.explicitRepository ?? getGlobalAuditRepository();
  }

  getRepository(): AuditRepository {
    return this.repository;
  }

  /**
   * Audits a seeded allow-listed demo scenario.
   */
  async auditDemoScenario(scenarioId: string): Promise<AuditReport> {
    if (!isAllowedScenarioId(scenarioId)) {
      throw new Error(`Invalid scenario ID: '${scenarioId}'. Must be one of the allow-listed scenarios.`);
    }

    const scenario = getScenarioById(scenarioId);
    const diffFullPath = resolveFixturePath(scenario.diffPath);

    if (!fs.existsSync(diffFullPath)) {
      throw new Error(`Scenario diff file not found at: ${diffFullPath}`);
    }

    const rawDiff = fs.readFileSync(diffFullPath, "utf-8");

    // 1. Run deterministic diff scanner
    const scanResult = this.scanner.scan(rawDiff);

    // 2. Run isolated behavior contract replay
    const replayOutcome = await this.replayRunner.replayScenario(scenarioId);

    // 3. Merge checks and findings
    const allFindings = [...scanResult.findings, ...replayOutcome.findings];
    const allChecks = [...scanResult.checks, ...replayOutcome.checks];

    // 4. Centrally compute status
    const statusResult = computeAuditStatus({
      findings: allFindings,
      checks: allChecks,
      requiredCheckIds: ["check-diff-parse"],
    });

    const reportId = `audit-${scenarioId}-${Date.now()}`;
    const report: AuditReport = AuditReportSchema.parse({
      id: reportId,
      createdAt: new Date().toISOString(),
      scenarioId,
      status: statusResult.status,
      summary:
        statusResult.status === "BLOCKED"
          ? `Audit BLOCKED: ${allFindings.length} issue(s) detected. ${statusResult.reasons[0]}`
          : statusResult.status === "REVIEW"
            ? `Audit REVIEW: ${allFindings.length} review items require inspection. ${statusResult.reasons[0]}`
            : "Audit PASS: All configured checks completed with zero blocking findings.",
      limitations: [
        "PASS means configured checks did not detect an issue; it does not prove arbitrary code correct.",
        "Deterministic scan evaluates supported JavaScript/TypeScript and CI YAML syntax patterns.",
        "Contract replay verifies approved baseline behaviors in isolated subprocess.",
      ],
      findings: allFindings,
      checks: allChecks,
    });

    // Save in in-memory store
    this.reportStore.set(reportId, report);

    // Persist sanitized audit record to configured repository (Atlas or local in-memory fallback)
    await this.repository
      .saveReport(report, { scenarioId })
      .catch(() => {
        // Safe degraded persistence - core demo never fails if storage has an issue
      });

    return report;
  }

  /**
   * Audits a raw unified diff string (e.g. from local git diff).
   */
  async auditDiff(rawDiff: string, baseRef = "main"): Promise<AuditReport> {
    const scanResult = this.scanner.scan(rawDiff);

    const statusResult = computeAuditStatus({
      findings: scanResult.findings,
      checks: scanResult.checks,
      requiredCheckIds: ["check-diff-parse"],
    });

    const reportId = `audit-diff-${Date.now()}`;
    const report: AuditReport = AuditReportSchema.parse({
      id: reportId,
      createdAt: new Date().toISOString(),
      baseRef,
      status: statusResult.status,
      summary:
        statusResult.status === "BLOCKED"
          ? `Audit BLOCKED: ${scanResult.findings.length} issue(s) detected.`
          : statusResult.status === "REVIEW"
            ? `Audit REVIEW: ${scanResult.findings.length} review items detected.`
            : "Audit PASS: Diff satisfies all configured deterministic integrity checks.",
      limitations: [
        "Local diff audit evaluates changed assertions, mocks, and CI workflows against baseline git ref.",
        "Protected contract replay requires registered contract definitions.",
      ],
      findings: scanResult.findings,
      checks: scanResult.checks,
    });

    this.reportStore.set(reportId, report);

    await this.repository
      .saveReport(report, { repositoryLabel: `repo/${baseRef}` })
      .catch(() => {
        // Safe degraded persistence
      });

    return report;
  }

  /**
   * Retrieves a stored audit report by ID from in-memory cache.
   */
  getReportById(id: string): AuditReport | undefined {
    return this.reportStore.get(id);
  }

  /**
   * Retrieves a sanitized audit record by ID from the configured repository.
   */
  async getPersistedReportById(id: string): Promise<PersistedAuditRecord | null> {
    return this.repository.getRecordById(id);
  }

  /**
   * Synchronously lists audit summaries from current memory store (backwards compatible).
   */
  listAuditSummaries(): AuditSummary[] {
    const summaries: AuditSummary[] = [];
    for (const report of this.reportStore.values()) {
      const checksSummary = {
        passed: report.checks.filter((c) => c.status === "passed").length,
        failed: report.checks.filter((c) => c.status === "failed").length,
        warning: report.checks.filter((c) => c.status === "warning").length,
        "not-run": report.checks.filter((c) => c.status === "not-run").length,
      };

      const summary = AuditSummarySchema.parse({
        id: report.id,
        createdAt: report.createdAt,
        scenarioId: report.scenarioId,
        status: report.status,
        findingsCount: report.findings.length,
        findings: report.findings.map((f) => ({
          id: f.id,
          ruleId: f.ruleId,
          severity: f.severity,
          source: f.source,
          title: f.title,
        })),
        checksSummary,
        isSample: false,
      });

      summaries.push(summary);
    }
    return summaries;
  }

  /**
   * Asynchronously queries audit summaries from the configured repository.
   */
  async listSummaries(options?: {
    limit?: number;
    scenarioId?: string;
    status?: string;
    includeSample?: boolean;
  }): Promise<AuditSummary[]> {
    return this.repository.listSummaries(options);
  }

  /**
   * Manually records a generated report in both in-memory store and repository.
   */
  recordReport(report: AuditReport): void {
    this.reportStore.set(report.id, report);
    this.repository.saveReport(report).catch(() => {});

    traceAuditStep(
      "Report Persistence",
      "audit.step.persistence",
      {
        stepName: "report-persistence",
        checkType: "persistence",
        reportId: report.id,
        resultStatus: report.status,
      },
      async () => {
        this.reportStore.set(report.id, report);
      }
    ).catch(() => {
      this.reportStore.set(report.id, report);
    });
  }

  /**
   * Executes the bounded Mastra audit pipeline and records the resulting report.
   */
  async runPipeline(params: RunAuditPipelineParams): Promise<MastraAuditWorkflowResult> {
    const result = await runAuditPipeline(params);
    if (result.report) {
      this.reportStore.set(result.report.id, result.report);
      await this.repository
        .saveReport(result.report, {
          scenarioId: params.scenarioId,
          trace: result.trace?.sentryTraceId
            ? {
                traceId: result.trace.sentryTraceId,
                spanId: result.trace.sentrySpanId,
                provider: "sentry",
                timestamp: result.trace.timestamp || new Date().toISOString(),
              }
            : undefined,
        })
        .catch(() => {});
    }
    return result;
  }
}

// Global singleton instance for API/CLI reuse
export const globalEngine = new GreenwashEngine();
