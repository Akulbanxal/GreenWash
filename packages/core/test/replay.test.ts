import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  BehaviorReplayRunner,
  loadBehaviorContract,
  computeAuditStatus,
} from "../src/index.js";

describe("Protected Behavior Contract & Replay Runner", () => {
  const runner = new BehaviorReplayRunner();

  it("loads and validates approved discount contract schema", () => {
    const contract = loadBehaviorContract();
    expect(contract.id).toBe("contract-discount-v1");
    expect(contract.version).toBe("1.0.0");
    expect(contract.targetFunction).toBe("calculateDiscount");
    expect(contract.cases.length).toBeGreaterThan(0);
    expect(contract.cases[0].expected).toBe(900);
  });

  it("dishonest patch fails replay: returns 1000 instead of 900 -> BLOCKED", async () => {
    const outcome = await runner.replayScenario("weakened-assertion");

    expect(outcome.contractId).toBe("contract-discount-v1");
    expect(outcome.caseResults.length).toBe(1);

    const caseRes = outcome.caseResults[0];
    expect(caseRes.passed).toBe(false);
    expect(caseRes.expected).toBe(900);
    expect(caseRes.actual).toBe(1000); // Dishonest failure caught!

    expect(outcome.findings.length).toBe(1);
    const finding = outcome.findings[0];
    expect(finding.ruleId).toBe("CONTRACT-VIOLATION");
    expect(finding.severity).toBe("critical");
    expect(finding.expected).toBe(900);
    expect(finding.actual).toBe(1000);
    expect(finding.humanAction).toContain("Candidate patch breaks verified contract behavior");

    // Status policy verification: CONTRACT-VIOLATION must compute BLOCKED
    const statusResult = computeAuditStatus({
      findings: outcome.findings,
      checks: outcome.checks,
    });
    expect(statusResult.status).toBe("BLOCKED");
  });

  it("honest fix passes replay: returns 900 cents -> PASS", async () => {
    const outcome = await runner.replayScenario("honest-fix");

    expect(outcome.caseResults.length).toBe(1);
    const caseRes = outcome.caseResults[0];
    expect(caseRes.passed).toBe(true);
    expect(caseRes.expected).toBe(900);
    expect(caseRes.actual).toBe(900);

    expect(outcome.findings.length).toBe(0);
    expect(outcome.checks.every((c) => c.status === "passed")).toBe(true);

    // Status policy verification: PASS
    const statusResult = computeAuditStatus({
      findings: outcome.findings,
      checks: outcome.checks,
    });
    expect(statusResult.status).toBe("PASS");
  });

  it("handles scenario without behavior contract gracefully (not-run state)", async () => {
    const outcome = await runner.replayScenario("deleted-test");
    expect(outcome.contractId).toBe("none");
    expect(outcome.checks[0].status).toBe("not-run");
    expect(outcome.findings.length).toBe(0);
  });

  it("rejects unknown scenario IDs with security error (zero arbitrary execution)", async () => {
    await expect(runner.replayScenario("arbitrary-attack")).rejects.toThrow(
      /Access Denied: Replay is only permitted for allow-listed scenario IDs/
    );
  });

  it("handles execution errors in candidate code (syntax error, missing function)", async () => {
    const badContract = {
      id: "contract-test-error",
      version: "1.0.0",
      description: "Test execution error handling",
      targetFile: "non-existent.ts",
      targetFunction: "nonExistentFn",
      cases: [
        {
          id: "case-error",
          name: "Error Case",
          input: {},
          expected: 100,
        },
      ],
    };

    const outcome = await runner.executeContractAgainstSource(
      badContract,
      path.resolve(process.cwd(), "fixtures/scenarios/honest-fix/source.ts")
    );

    expect(outcome.caseResults[0].passed).toBe(false);
    expect(outcome.checks[0].status).toBe("failed");
    expect(outcome.findings[0].ruleId).toBe("CONTRACT-RUNNER-ERROR");
  });

  it("handles subprocess timeout safely; timed-out replay is NOT a PASS", async () => {
    // Create temporary script with an intentional infinite loop
    const scratchDir = path.resolve(process.cwd(), "fixtures/scenarios/scratch");
    fs.mkdirSync(scratchDir, { recursive: true });
    const infiniteLoopFile = path.resolve(scratchDir, "infinite-loop.js");
    fs.writeFileSync(
      infiniteLoopFile,
      `export async function loopForever() {
        while (true) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }`
    );

    const timeoutContract = {
      id: "contract-timeout",
      version: "1.0.0",
      description: "Test timeout protection",
      targetFile: "infinite-loop.js",
      targetFunction: "loopForever",
      cases: [
        {
          id: "case-timeout",
          name: "Timeout Invariant",
          input: {},
          expected: 42,
        },
      ],
    };

    const outcome = await runner.executeContractAgainstSource(timeoutContract, infiniteLoopFile, {
      timeoutMs: 300, // Short timeout
    });

    expect(outcome.caseResults[0].passed).toBe(false);
    expect(outcome.caseResults[0].error).toContain("timed out after 300ms");
    expect(outcome.checks[0].status).toBe("failed");
    expect(outcome.findings[0].ruleId).toBe("CONTRACT-RUNNER-ERROR");

    // Clean up scratch file
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });
});
