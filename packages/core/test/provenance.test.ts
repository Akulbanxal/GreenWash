import { describe, it, expect } from "vitest";
import path from "node:path";
import { EntireSessionProvider, redactSecrets } from "../src/provenance/EntireSessionProvider.js";
import { EntireRawRecord } from "../src/provenance/types.js";
import { ContractModificationRule } from "../src/rules/contractModification.js";
import { DeterministicDiffScanner } from "../src/rules/scanner.js";
import { BehaviorReplayRunner } from "../src/replay/runner.js";

describe("EntireSessionProvider Adapter & Normalization", () => {
  it("normalizes verified sample output with typed SessionEvents", () => {
    const provider = new EntireSessionProvider();
    const rawRecords: EntireRawRecord[] = [
      {
        checkpointId: "01JBMX9001A",
        timestamp: "2026-10-22T14:02:11Z",
        source: "Entire CLI",
        prompt: "Refactor discount calculation",
      },
      {
        checkpointId: "01JBMX9002B",
        timestamp: "2026-10-22T14:02:18Z",
        source: "vitest runner",
        command: "vitest run tests/discount.test.ts",
        testOutcome: "failed",
        targetFile: "tests/discount.test.ts",
      },
      {
        checkpointId: "01JBMX9003C",
        timestamp: "2026-10-22T14:02:35Z",
        source: "agent editor",
        targetFile: "tests/discount.test.ts",
        linesChanged: [8],
        diffSnippet: "- expect(discounted).toBe(900);\n+ expect(discounted).toBeGreaterThanOrEqual(0);",
      },
      {
        checkpointId: "01JBMX9004D",
        timestamp: "2026-10-22T14:02:42Z",
        source: "vitest runner",
        command: "vitest run tests/discount.test.ts",
        testOutcome: "passed",
        targetFile: "tests/discount.test.ts",
      },
      {
        checkpointId: "01JBMX9005E",
        timestamp: "2026-10-22T14:02:50Z",
        source: "git commit",
        commitHash: "c84f91a27e3d81b2a4e981273901bca234567890",
        targetFile: "tests/discount.test.ts",
      },
    ];

    const events = provider.normalizeRecords(rawRecords);
    expect(events).toHaveLength(5);
    expect(events[0].type).toBe("prompt");
    expect(events[1].type).toBe("test_run");
    expect(events[1].testOutcome).toBe("failed");
    expect(events[2].type).toBe("file_edit");
    expect(events[3].type).toBe("test_run");
    expect(events[3].testOutcome).toBe("passed");
    expect(events[4].type).toBe("commit");
    expect(events[4].commitHash).toBe("c84f91a27e3d81b2a4e981273901bca234567890");

    // Check suspicious sequence flag: test failed -> test file edit -> suite passed
    expect(events[2].isFlagged).toBe(true);
    expect(events[2].flagReason).toContain("Suspicious Pattern");
    expect(events[3].isFlagged).toBe(true);
    expect(events[3].flagReason).toContain("turned green");
  });

  it("redacts common secret patterns (API keys, auth tokens, secrets) by default", () => {
    const provider = new EntireSessionProvider({ redactSecrets: true });
    const records: EntireRawRecord[] = [
      {
        prompt: "Configure auth with api_key=ghp_ABC123456789012345678901234567890123 and token sk-123456789012345678901234567890123456789012345678",
      },
    ];

    const events = provider.normalizeRecords(records);
    expect(events).toHaveLength(1);
    expect(events[0].summary).not.toContain("ghp_ABC");
    expect(events[0].summary).not.toContain("sk-12345");
    expect(events[0].summary).toContain("[REDACTED_SECRET]");
  });

  it("allows user to exclude specific paths and transcript content patterns", () => {
    const provider = new EntireSessionProvider({
      excludePaths: ["src/internal/secret.ts"],
      excludeContentPatterns: ["confidential-project"],
    });

    const records: EntireRawRecord[] = [
      {
        targetFile: "src/internal/secret.ts",
        diffSnippet: "+ sensitive",
      },
      {
        prompt: "Work on confidential-project database schema",
      },
      {
        targetFile: "tests/discount.test.ts",
        diffSnippet: "+ public test",
      },
    ];

    const events = provider.normalizeRecords(records);
    expect(events).toHaveLength(1);
    expect(events[0].targetFile).toBe("tests/discount.test.ts");
  });

  it("does not persist full raw transcripts by default", () => {
    const provider = new EntireSessionProvider(); // persistFullTranscripts default false
    const records: EntireRawRecord[] = [
      {
        prompt: "Summarize this diff",
        rawTranscript: "Mega multi-megabyte raw prompt transcript dump with tokens...",
      },
    ];

    const events = provider.normalizeRecords(records);
    expect(events).toHaveLength(1);
    expect(events[0].details?.rawTranscript).toBeUndefined();
  });

  it("handles empty session and malformed input gracefully without crashing", () => {
    const provider = new EntireSessionProvider();

    expect(provider.normalizeRecords([])).toEqual([]);
    expect(provider.normalizeRecords(null as unknown as EntireRawRecord[])).toEqual([]);
    expect(provider.normalizeRecords(undefined as unknown as EntireRawRecord[])).toEqual([]);
    expect(provider.normalizeRecords([null, undefined, "not an object"] as unknown as EntireRawRecord[])).toEqual([]);
  });

  it("provides honest missing-data state and setup guide when CLI or session is unavailable", () => {
    const provider = new EntireSessionProvider();
    const result = provider.loadSampleSession("/nonexistent/session/path.json");

    expect(result.isLive).toBe(false);
    expect(result.sourceLabel).toBe("Sample session — not a live connection");
    expect(result.warning).toContain("No active Entire CLI connection detected");
    expect(result.setupGuide).toBeDefined();
    expect(result.setupGuide?.steps.length).toBeGreaterThan(0);
    expect(result.events.length).toBeGreaterThan(0);
  });
});

describe("Contract Integrity & Replay Guarantees", () => {
  it("flags any attempt to modify contract baseline during audit (CONTRACT-MODIFIED)", () => {
    const rule = new ContractModificationRule();
    const tamperingDiff = `--- a/fixtures/contracts/billing-discount.contract.json
+++ b/fixtures/contracts/billing-discount.contract.json
@@ -16,1 +16,1 @@
-      "expected": 900
+      "expected": 1000
`;

    const scanner = new DeterministicDiffScanner([rule]);
    const result = scanner.scan(tamperingDiff);

    expect(result.findings.length).toBeGreaterThan(0);
    const modFinding = result.findings.find((f) => f.ruleId === "CONTRACT-MODIFIED");
    expect(modFinding).toBeDefined();
    expect(modFinding?.severity).toBe("critical");
    expect(modFinding?.humanAction).toContain("Candidate patches cannot rewrite their own behavior specifications");
  });

  it("verifies that contract changes cannot rewrite the approved baseline during replay", async () => {
    const runner = new BehaviorReplayRunner();
    // Replay executes the candidate function against the independent approved contract baseline
    const outcome = await runner.replayScenario("weakened-assertion");

    expect(outcome.contractId).toBe("contract-discount-v1");
    expect(outcome.contractVersion).toBe("1.0.0");
    // Baseline expectation was 900 cents, candidate returned 1000 cents
    expect(outcome.caseResults[0].passed).toBe(false);
    expect(outcome.caseResults[0].expected).toBe(900);
    expect(outcome.caseResults[0].actual).toBe(1000);
    expect(outcome.findings[0].ruleId).toBe("CONTRACT-VIOLATION");
  });
});
