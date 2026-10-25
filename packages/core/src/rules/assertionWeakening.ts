import { AuditFinding } from "../domain/schemas.js";
import { DiffRule, RuleContext, getFilePath, isTestFile } from "./types.js";

/**
 * Rule 1: Assertion Weakening
 * Detects replacement of strict/exact assertions (toBe(X), toEqual(X), assert x == y)
 * with loose existence, truthiness, or unconstrained relational inequalities
 * (toBeGreaterThanOrEqual(0), toBeDefined(), assertTrue(bool), etc.).
 */
export class AssertionWeakeningRule implements DiffRule {
  readonly id = "AST-ASSERT-WEAKENED";
  readonly name = "Assertion Weakening";
  readonly description =
    "Exact expected values or structured assertions replaced with truthiness, loose existence, or broad matchers.";
  readonly supportedSyntax = ["Jest/Vitest expect(...).toBe(...)", "Python assert ==, assertEqual"];
  readonly defaultSeverity = "critical";
  readonly knownFalsePositives = [
    "Intentional relaxation when API schema switches from exact ID to generic string ID.",
    "Property-based testing parameter sweeps.",
  ];

  execute(context: RuleContext): AuditFinding[] {
    const findings: AuditFinding[] = [];

    const STRICT_PATTERNS = [
      /\.toBe\s*\(/,
      /\.toEqual\s*\(/,
      /\.toStrictEqual\s*\(/,
      /assert\s+[\w.()]+\s*==\s*/,
      /assertEqual\s*\(/,
    ];

    const WEAK_PATTERNS = [
      { pattern: /\.toBeGreaterThanOrEqual\s*\(\s*0\s*\)/, label: "relational inequality >= 0" },
      { pattern: /\.toBeGreaterThan\s*\(/, label: "relational inequality >" },
      { pattern: /\.toBeDefined\s*\(\s*\)/, label: "loose existence toBeDefined()" },
      { pattern: /\.toBeTruthy\s*\(\s*\)/, label: "loose truthiness toBeTruthy()" },
      { pattern: /\.not\.toBeNull\s*\(\s*\)/, label: "loose null-check not.toBeNull()" },
      { pattern: /assert\s+[\w.()]+\s*>=\s*0/, label: "relational inequality >= 0" },
      { pattern: /assertTrue\s*\(/, label: "loose truthiness assertTrue()" },
    ];

    for (const file of context.files) {
      const filePath = getFilePath(file);
      if (!isTestFile(filePath)) {
        continue;
      }

      for (const chunk of file.chunks) {
        let deletedStrictCount = 0;
        let deletedSnippet = "";
        let deletedLine = chunk.newStart;

        for (const change of chunk.changes) {
          if (change.type === "del") {
            const hasStrict = STRICT_PATTERNS.some((p) => p.test(change.content));
            if (hasStrict) {
              deletedStrictCount++;
              deletedSnippet = change.content.slice(1).trim();
              deletedLine = change.ln || chunk.newStart;
            }
          }
        }

        if (deletedStrictCount > 0) {
          for (const change of chunk.changes) {
            if (change.type === "add") {
              const matchedWeak = WEAK_PATTERNS.find((w) => w.pattern.test(change.content));
              if (matchedWeak) {
                const addedSnippet = change.content.slice(1).trim();
                const lineNum = change.ln || deletedLine;

                findings.push({
                  id: `fnd-weaken-${filePath}-${lineNum}`,
                  ruleId: this.id,
                  title: "Weakened Test Assertion",
                  summary: `Exact equality check was replaced with ${matchedWeak.label}.`,
                  severity: this.defaultSeverity,
                  source: "static-rule",
                  evidence: [
                    {
                      filePath,
                      startLine: lineNum,
                      endLine: lineNum,
                      title: "Strict assertion loosened",
                      detail: `Before: "${deletedSnippet}" -> After: "${addedSnippet}"`,
                      beforeSnippet: deletedSnippet,
                      afterSnippet: addedSnippet,
                      diffHunk: chunk.content,
                    },
                  ],
                  expected: deletedSnippet,
                  actual: addedSnippet,
                  reproductionCommand: `npx vitest run ${filePath}`,
                  humanAction:
                    "Reject patch. Restore exact value expectation and fix underlying domain defect.",
                  limitations: [
                    "Static diff scanner detects assertion shape; independent behavior contract confirms whether runtime is violated.",
                  ],
                });
                break;
              }
            }
          }
        }
      }
    }

    return findings;
  }
}
