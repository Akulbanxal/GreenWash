import { describe, it, expect } from "vitest";
import { createCli, formatReportText } from "../src/index.js";
import { globalEngine } from "@greenwash/core";

describe("Greenwash CLI Parity Tests", () => {
  it("initializes CLI with check and demo subcommands", () => {
    const cli = createCli();
    expect(cli.name()).toBe("greenwash");

    const cmdNames = cli.commands.map((c) => c.name());
    expect(cmdNames).toContain("check");
    expect(cmdNames).toContain("demo");
    expect(cmdNames).toContain("test-mongo");
    expect(cmdNames).toContain("synthesize");
    expect(cmdNames).toContain("stream-provenance");
  });

  it("formats AuditReport text faithfully without omitting findings or limitations", async () => {
    const report = await globalEngine.auditDemoScenario("weakened-assertion");
    const formatted = formatReportText(report);

    expect(formatted).toContain("GREENWASH AUDIT REPORT [BLOCKED]");
    expect(formatted).toContain("weakened-assertion");
    expect(formatted).toContain("AST-ASSERT-WEAKENED");
    expect(formatted).toContain("CONTRACT-VIOLATION");
    expect(formatted).toContain("LIMITATIONS:");
    expect(formatted).toContain("Expected: 900");
    expect(formatted).toContain("Actual:   1000");
  });

  it("produces valid JSON identical to core AuditReport schema", async () => {
    const report = await globalEngine.auditDemoScenario("honest-fix");
    const jsonStr = JSON.stringify(report, null, 2);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.status).toBe("PASS");
    expect(parsed.findings.length).toBe(0);
    expect(parsed.checks.length).toBeGreaterThan(0);
  });
});
