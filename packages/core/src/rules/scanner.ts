import { AuditFinding, AuditCheck } from "../domain/schemas.js";
import { DiffRule, safeParseDiff, RuleContext } from "./types.js";
import { AssertionWeakeningRule } from "./assertionWeakening.js";
import { TestDeletionRule } from "./testDeletion.js";
import { TestSkippingRule } from "./testSkipping.js";
import { MockSubstitutionRule } from "./mockSubstitution.js";
import { CiGateWeakeningRule } from "./ciGateWeakening.js";
import { ContractModificationRule } from "./contractModification.js";
import { PythonIntegrityRule, PythonDiffScanner } from "./pythonScanner.js";

export * from "./types.js";
export * from "./assertionWeakening.js";
export * from "./testDeletion.js";
export * from "./testSkipping.js";
export * from "./mockSubstitution.js";
export * from "./ciGateWeakening.js";
export * from "./contractModification.js";
export * from "./pythonScanner.js";

export interface ScanResult {
  findings: AuditFinding[];
  checks: AuditCheck[];
  parseError?: string;
}

export class DeterministicDiffScanner {
  private readonly rules: DiffRule[];

  constructor(customRules?: DiffRule[]) {
    this.rules = customRules || [
      new AssertionWeakeningRule(),
      new TestDeletionRule(),
      new TestSkippingRule(),
      new MockSubstitutionRule(),
      new CiGateWeakeningRule(),
      new ContractModificationRule(),
      new PythonIntegrityRule(),
    ];
  }

  getRules(): readonly DiffRule[] {
    return this.rules;
  }

  scan(rawDiff: string, contractPaths?: string[]): ScanResult {
    const startTime = Date.now();

    if (!rawDiff || rawDiff.trim().length === 0) {
      return {
        findings: [],
        checks: [
          {
            id: "check-diff-parse",
            label: "Unified Diff Parsing",
            status: "warning",
            detail: "Diff content is empty",
            durationMs: 0,
          },
        ],
      };
    }

    const files = safeParseDiff(rawDiff);
    if (files.length === 0) {
      // Parse failure becomes visible warning, NEVER a false PASS!
      return {
        findings: [],
        checks: [
          {
            id: "check-diff-parse",
            label: "Unified Diff Parsing",
            status: "warning",
            detail: "Failed to parse unified diff format (malformed diff input)",
            durationMs: Date.now() - startTime,
          },
        ],
        parseError: "Malformed unified diff",
      };
    }

    const context: RuleContext = {
      files,
      rawDiff,
      contractPaths,
    };

    const allFindings: AuditFinding[] = [];
    const checks: AuditCheck[] = [
      {
        id: "check-diff-parse",
        label: "Unified Diff Parsing",
        status: "passed",
        detail: `Successfully parsed ${files.length} file hunk(s)`,
        durationMs: Date.now() - startTime,
      },
    ];

    for (const rule of this.rules) {
      const ruleStart = Date.now();
      try {
        const ruleFindings = rule.execute(context);
        allFindings.push(...ruleFindings);

        checks.push({
          id: `check-rule-${rule.id}`,
          label: rule.name,
          status: ruleFindings.length === 0 ? "passed" : "failed",
          detail:
            ruleFindings.length === 0
              ? `No violations of ${rule.name}`
              : `Detected ${ruleFindings.length} violation(s)`,
          durationMs: Date.now() - ruleStart,
        });
      } catch (err: unknown) {
        checks.push({
          id: `check-rule-${rule.id}`,
          label: rule.name,
          status: "failed",
          detail: `Rule execution error: ${err instanceof Error ? err.message : String(err)}`,
          durationMs: Date.now() - ruleStart,
        });
      }
    }

    return {
      findings: allFindings,
      checks,
    };
  }
}
