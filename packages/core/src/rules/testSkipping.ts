import { AuditFinding } from "../domain/schemas.js";
import { DiffRule, RuleContext, getFilePath, isTestFile } from "./types.js";

/**
 * Rule 3: Test Skipping / Disablement
 * Detects newly introduced .skip, xit, xdescribe, test.skip, @pytest.mark.skip,
 * or .only filters that bypass test suite execution.
 */
export class TestSkippingRule implements DiffRule {
  readonly id = "AST-TEST-SKIPPED";
  readonly name = "Test Skipping / Disablement";
  readonly description =
    "Tests newly gain skip/only/disabled markers or decorators bypassing test execution.";
  readonly supportedSyntax = [
    "it.skip, test.skip, describe.skip",
    "xit, xdescribe, xtest",
    "it.only, test.only",
    "@pytest.mark.skip, @pytest.mark.skipif",
  ];
  readonly defaultSeverity = "high";
  readonly knownFalsePositives = [
    "Temporary skip during work-in-progress draft PRs with explicit TODO tickets.",
  ];

  execute(context: RuleContext): AuditFinding[] {
    const findings: AuditFinding[] = [];

    const SKIP_PATTERNS = [
      { pattern: /\bit\.skip\b/, label: "it.skip" },
      { pattern: /\btest\.skip\b/, label: "test.skip" },
      { pattern: /\bdescribe\.skip\b/, label: "describe.skip" },
      { pattern: /\bxit\s*\(/, label: "xit()" },
      { pattern: /\bxtest\s*\(/, label: "xtest()" },
      { pattern: /\bxdescribe\s*\(/, label: "xdescribe()" },
      { pattern: /\bit\.only\b/, label: "it.only (focus isolation)" },
      { pattern: /\btest\.only\b/, label: "test.only (focus isolation)" },
      { pattern: /@pytest\.mark\.skip/, label: "@pytest.mark.skip" },
      { pattern: /@pytest\.mark\.skipif/, label: "@pytest.mark.skipif" },
      { pattern: /@unittest\.skip/, label: "@unittest.skip" },
    ];

    for (const file of context.files) {
      const filePath = getFilePath(file);
      if (!isTestFile(filePath)) {
        continue;
      }

      for (const chunk of file.chunks) {
        for (const change of chunk.changes) {
          if (change.type === "add") {
            const rawLine = change.content.slice(1);
            const matched = SKIP_PATTERNS.find((s) => s.pattern.test(rawLine));

            if (matched) {
              const lineNum = change.ln || chunk.newStart;

              findings.push({
                id: `fnd-skip-${filePath}-${lineNum}`,
                ruleId: this.id,
                title: "Test Execution Disabled",
                summary: `Test suite newly introduced ${matched.label} directive in ${filePath}.`,
                severity: this.defaultSeverity,
                source: "static-rule",
                evidence: [
                  {
                    filePath,
                    startLine: lineNum,
                    endLine: lineNum,
                    title: `Skip modifier: ${matched.label}`,
                    detail: `Line added: "${rawLine.trim()}"`,
                    afterSnippet: rawLine.trim(),
                    diffHunk: chunk.content,
                  },
                ],
                reproductionCommand: `grep -n "${matched.label}" ${filePath}`,
                humanAction:
                  "Reject skip modifier. Ensure test runs and passes against candidate implementation.",
                limitations: [
                  "Does not evaluate whether test is legitimately quarantined in an isolated PR.",
                ],
              });
            }
          }
        }
      }
    }

    return findings;
  }
}
