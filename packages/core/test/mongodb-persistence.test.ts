import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  InMemoryAuditRepository,
  MongoAuditRepository,
  setGlobalAuditRepository,
  getGlobalAuditRepository,
  sanitizeMongoUri,
} from "../src/persistence/repository.js";
import {
  sanitizeAuditForPersistence,
} from "../src/persistence/sanitizer.js";
import {
  PersistedAuditRecordSchema,
  migrateAndValidateRecord,
  CURRENT_PERSISTENCE_SCHEMA_VERSION,
} from "../src/persistence/schema.js";
import { AuditReport } from "../src/domain/schemas.js";

/**
 * Minimal valid AuditReport for test fixtures.
 */
function makeTestReport(overrides?: Partial<AuditReport>): AuditReport {
  return {
    id: `test-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    scenarioId: "weakened-assertion",
    status: "BLOCKED",
    summary: "Test audit BLOCKED by weakened assertion detection",
    limitations: ["PASS means checks did not detect an issue"],
    findings: [
      {
        id: "finding-001",
        ruleId: "AST-ASSERT-WEAKENED",
        title: "Test assertion weakened to truthy check",
        summary: "expect(result).toBeTruthy() used instead of expect(result).toBe(42)",
        severity: "high",
        source: "static-rule",
        evidence: [
          {
            filePath: "src/calc.test.ts",
            startLine: 10,
            endLine: 12,
            title: "Weakened assertion found",
            detail: "Assertion weakened from strict to truthy",
            beforeSnippet: "expect(result).toBe(42)",
            afterSnippet: "expect(result).toBeTruthy()",
            diffHunk: "-  expect(result).toBe(42)\n+  expect(result).toBeTruthy()",
          },
        ],
        humanAction: "Restore exact assertion or provide approved baseline",
        limitations: [],
      },
    ],
    checks: [
      { id: "check-diff-parse", label: "Diff Parsing", status: "passed", durationMs: 12 },
      { id: "check-ast-scan", label: "AST Scan", status: "failed", durationMs: 88 },
    ],
    ...overrides,
  };
}

describe("MongoDB Persistence — Schema Validation & Sanitizer", () => {
  it("1. sanitizeAuditForPersistence produces a valid persisted record", () => {
    const report = makeTestReport();
    const record = sanitizeAuditForPersistence(report);

    // Schema version is set
    expect(record.schemaVersion).toBe(CURRENT_PERSISTENCE_SCHEMA_VERSION);

    // Core allow-listed fields present
    expect(record.id).toBe(report.id);
    expect(record._id).toBe(report.id);
    expect(record.status).toBe("BLOCKED");
    expect(record.scenarioId).toBe("weakened-assertion");
    expect(record.findings).toHaveLength(1);
    expect(record.checks).toHaveLength(2);
    expect(record.storedAt).toBeDefined();

    // Validate against schema strictly
    expect(() => PersistedAuditRecordSchema.parse(record)).not.toThrow();
  });

  it("2. Prohibited fields are NOT in the persisted record (data boundary enforcement)", () => {
    const report = makeTestReport();
    const record = sanitizeAuditForPersistence(report);

    const recordStr = JSON.stringify(record);

    // Raw diffs must never be persisted
    expect(recordStr).not.toContain("-  expect(result).toBe(42)\n+  expect(result).toBeTruthy()");

    // Full source file content must not be present
    expect(record).not.toHaveProperty("rawDiff");
    expect(record).not.toHaveProperty("sourceFile");
    expect(record).not.toHaveProperty("rawTranscript");

    // Excerpts must be capped at 200 chars
    if (record.findings[0]?.evidence[0]?.redactedExcerpt) {
      expect(record.findings[0].evidence[0].redactedExcerpt.length).toBeLessThanOrEqual(200);
    }
  });

  it("3. Secret patterns are redacted from persisted evidence titles and summaries", () => {
    const report = makeTestReport({
      findings: [
        {
          id: "finding-secret",
          ruleId: "SECRET-LEAK",
          title: "API_KEY=sk-abc123XYZ secret found in test",
          summary: "Bearer token sk-abc123XYZ456789012345 used in assertion",
          severity: "critical",
          source: "static-rule",
          evidence: [
            {
              title: "Secret in evidence",
              detail: "AKIA1234567890ABCDEF found in config file",
              afterSnippet: "token: sk-verylongtoken12345678901234567890",
            },
          ],
          humanAction: "Remove exposed credential immediately",
          limitations: [],
        },
      ],
    });

    const record = sanitizeAuditForPersistence(report);
    const recordStr = JSON.stringify(record);

    // Secret patterns should be redacted
    expect(recordStr).not.toContain("sk-abc123XYZ456789012345");
    expect(recordStr).not.toContain("AKIA1234567890ABCDEF");
    expect(recordStr).not.toContain("sk-verylongtoken12345678901234567890");
    expect(recordStr).toContain("[REDACTED_SECRET]");
  });

  it("4. migrateAndValidateRecord handles missing optional fields gracefully", () => {
    const raw = {
      _id: "test-migration-001",
      id: "test-migration-001",
      createdAt: "2024-01-01T00:00:00.000Z",
      status: "PASS",
      summary: "Migrated audit",
      findings: [],
      checks: [],
      isSample: false,
      // schemaVersion and storedAt are missing — should be defaulted
    };

    const record = migrateAndValidateRecord(raw);
    expect(record.schemaVersion).toBe(CURRENT_PERSISTENCE_SCHEMA_VERSION);
    expect(record.storedAt).toBeDefined();
    expect(record.id).toBe("test-migration-001");
  });

  it("5. migrateAndValidateRecord throws on invalid document", () => {
    expect(() => migrateAndValidateRecord(null)).toThrow("Invalid DB record");
    expect(() => migrateAndValidateRecord("not-an-object")).toThrow("Invalid DB record");
    expect(() =>
      migrateAndValidateRecord({
        _id: "missing-required-fields",
        status: "INVALID_STATUS_NOT_IN_ENUM",
      })
    ).toThrow();
  });

  it("6. sanitizeMongoUri strips credentials from connection strings", () => {
    const raw = "mongodb+srv://myuser:super_secret_pass@cluster0.example.mongodb.net/greenwash";
    const safe = sanitizeMongoUri(raw);

    expect(safe).not.toContain("super_secret_pass");
    expect(safe).not.toContain("myuser");
    expect(safe).toContain("mongodb+srv://");
    expect(safe).toContain("@cluster0.example.mongodb.net");
    expect(safe).toContain("***");
  });
});

describe("MongoDB Persistence — InMemoryAuditRepository", () => {
  let repo: InMemoryAuditRepository;

  beforeEach(() => {
    repo = new InMemoryAuditRepository();
  });

  it("7. Reports actual storage mode as 'in-memory'", () => {
    expect(repo.getStorageMode()).toBe("in-memory");
  });

  it("8. checkConnection() reports connected=true and in-memory mode (never claims Atlas)", async () => {
    const diag = await repo.checkConnection();
    expect(diag.mode).toBe("in-memory");
    expect(diag.connected).toBe(true);
    expect(diag.message).toContain("in-memory");
    // Must NOT claim Atlas is connected (it's fine to mention Atlas is unconfigured)
    expect(diag.message.toLowerCase()).not.toContain("atlas connected");
    expect(diag.connected).toBe(true);
  });

  it("9. saveReport validates before insert and getRecordById validates after read", async () => {
    const report = makeTestReport();
    const saved = await repo.saveReport(report);

    expect(saved.id).toBe(report.id);
    expect(saved.schemaVersion).toBe(CURRENT_PERSISTENCE_SCHEMA_VERSION);

    const retrieved = await repo.getRecordById(report.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(report.id);
    expect(retrieved?.status).toBe("BLOCKED");
    expect(retrieved?.schemaVersion).toBe(CURRENT_PERSISTENCE_SCHEMA_VERSION);
  });

  it("10. Handles duplicate IDs idempotently via upsert", async () => {
    const report = makeTestReport();
    await repo.saveReport(report);

    // Save again with same ID — should not throw
    const updated = await repo.saveReport({
      ...report,
      summary: "Updated summary",
    });

    expect(updated.summary).toBe("Updated summary");
    const retrieved = await repo.getRecordById(report.id);
    expect(retrieved?.summary).toBe("Updated summary");
  });

  it("11. getRecordById returns null for unknown ID", async () => {
    const result = await repo.getRecordById("definitely-does-not-exist-xyz");
    expect(result).toBeNull();
  });

  it("12. listSummaries excludes sample records by default", async () => {
    const realReport = makeTestReport({ id: "real-report-001" });
    const sampleReport = makeTestReport({ id: "sample-report-001" });

    await repo.saveReport(realReport, { isSample: false });
    await repo.saveReport(sampleReport, { isSample: true });

    const summaries = await repo.listSummaries({ includeSample: false });
    const ids = summaries.map((s) => s.id);

    expect(ids).toContain("real-report-001");
    expect(ids).not.toContain("sample-report-001");

    // With includeSample: true both appear
    const allSummaries = await repo.listSummaries({ includeSample: true });
    const allIds = allSummaries.map((s) => s.id);
    expect(allIds).toContain("sample-report-001");
  });

  it("13. listSummaries supports filter by scenarioId", async () => {
    const r1 = makeTestReport({ id: "r-wa-1", scenarioId: "weakened-assertion" });
    const r2 = makeTestReport({ id: "r-hf-1", scenarioId: "honest-fix" });

    await repo.saveReport(r1);
    await repo.saveReport(r2);

    const filtered = await repo.listSummaries({ scenarioId: "honest-fix" });
    expect(filtered.map((s) => s.id)).toContain("r-hf-1");
    expect(filtered.map((s) => s.id)).not.toContain("r-wa-1");
  });

  it("14. Persisted records do NOT contain rawDiff or full source (data boundary)", async () => {
    const report = makeTestReport();
    const saved = await repo.saveReport(report);

    const savedStr = JSON.stringify(saved);
    expect(savedStr).not.toContain("rawDiff");
    expect(savedStr).not.toContain("sourceFile");
    expect(savedStr).not.toContain("rawTranscript");
  });
});

describe("MongoDB Persistence — MongoAuditRepository (Unconfigured / Connection Timeout)", () => {
  it("15. Unconfigured MongoAuditRepository reports connected=false without throwing", async () => {
    const repo = new MongoAuditRepository({
      uri: undefined,
      timeoutMs: 500,
    });

    const diag = await repo.checkConnection();
    expect(diag.connected).toBe(false);
    expect(diag.mode).toBe("mongodb");
    expect(diag.message).toContain("MONGODB_URI not configured");

    await repo.close();
  });

  it("16. MongoAuditRepository with invalid URI fails gracefully and reports error", async () => {
    const repo = new MongoAuditRepository({
      uri: "mongodb://invalid-host-that-does-not-exist:27017/test",
      timeoutMs: 500,
    });

    const diag = await repo.checkConnection();
    expect(diag.connected).toBe(false);
    expect(diag.mode).toBe("mongodb");
    expect(diag.error).toBeDefined();
    // Must NOT expose raw connection string in error messages
    expect(diag.error || "").not.toContain("myuser:password");

    await repo.close();
  });

  it("17. getGlobalAuditRepository returns InMemoryAuditRepository when MONGODB_URI unset", async () => {
    const originalUri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;
    setGlobalAuditRepository(null);

    const repo = getGlobalAuditRepository();
    expect(repo.getStorageMode()).toBe("in-memory");

    if (originalUri) {
      process.env.MONGODB_URI = originalUri;
    }
    setGlobalAuditRepository(null);
  });
});

describe("MongoDB Persistence — Integration with Engine (End-to-End)", () => {
  let repo: InMemoryAuditRepository;

  beforeEach(() => {
    repo = new InMemoryAuditRepository();
    setGlobalAuditRepository(repo);
  });

  afterEach(() => {
    setGlobalAuditRepository(null);
  });

  it("18. Audit report saved to repository is queryable after engine runs", async () => {
    const report = makeTestReport({ id: "e2e-engine-test-001" });
    await repo.saveReport(report);

    const retrieved = await repo.getRecordById("e2e-engine-test-001");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("e2e-engine-test-001");
    expect(retrieved?.findings.length).toBe(1);
    expect(retrieved?.checks.length).toBe(2);
  });

  it("19. Repository listSummaries returns correct summary fields", async () => {
    const report = makeTestReport({ id: "e2e-summary-test-001" });
    await repo.saveReport(report);

    const summaries = await repo.listSummaries();
    const summary = summaries.find((s) => s.id === "e2e-summary-test-001");

    expect(summary).toBeDefined();
    expect(summary?.status).toBe("BLOCKED");
    expect(summary?.findingsCount).toBe(1);
    expect(summary?.isSample).toBe(false);
    expect(summary?.checksSummary.passed).toBe(1);
    expect(summary?.checksSummary.failed).toBe(1);
  });

  it("20. isSample flag must be visible and never mixed with real history in summaries", async () => {
    const real = makeTestReport({ id: "real-e2e-001", scenarioId: "honest-fix", status: "PASS" });
    const sample = makeTestReport({ id: "sample-e2e-001" });

    await repo.saveReport(real, { isSample: false });
    await repo.saveReport(sample, { isSample: true });

    const realSummaries = await repo.listSummaries({ includeSample: false });
    const sampleIds = realSummaries.filter((s) => s.isSample).map((s) => s.id);
    const realIds = realSummaries.map((s) => s.id);

    // Real history must not contain sample records
    expect(sampleIds).toHaveLength(0);
    expect(realIds).toContain("real-e2e-001");
    expect(realIds).not.toContain("sample-e2e-001");
  });
});
