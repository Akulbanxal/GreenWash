import { AuditFinding } from "../domain/schemas.js";
import { DiffRule, RuleContext, getFilePath, isTestFile } from "./types.js";

/**
 * Rule 4: Mock Substitution
 * Detects newly introduced mock overrides (vi.spyOn, jest.spyOn, mockReturnValue, @patch)
 * that may mock out the unit under test.
 * Severe as REVIEW by default unless independent replay catches contract violation.
 */
export class MockSubstitutionRule implements DiffRule {
  readonly id = "AST-MOCK-SUBSTITUTION";
  readonly name = "Mock Substitution";
  readonly description =
    "A test starts mocking implementation or dependencies in a way that may bypass behavior under test.";
  readonly supportedSyntax = [
    "vi.spyOn, jest.spyOn",
    "mockReturnValue, mockImplementation",
    "unittest.mock.patch, @patch",
  ];
  readonly defaultSeverity = "medium";
  readonly knownFalsePositives = [
    "Legitimate mock of external network/database client in unit tests.",
  ];

  execute(context: RuleContext): AuditFinding[] {
    const findings: AuditFinding[] = [];

    const MOCK_PATTERNS = [
      { pattern: /vi\.spyOn\s*\([^)]+\)\.mockReturnValue/, label: "vi.spyOn mockReturnValue" },
      { pattern: /jest\.spyOn\s*\([^)]+\)\.mockReturnValue/, label: "jest.spyOn mockReturnValue" },
      { pattern: /vi\.fn\s*\(\s*\)\.mockReturnValue/, label: "vi.fn mockReturnValue" },
      { pattern: /jest\.fn\s*\(\s*\)\.mockReturnValue/, label: "jest.fn mockReturnValue" },
      { pattern: /@patch\s*\(/, label: "Python @patch" },
      { pattern: /unittest\.mock\.patch/, label: "unittest.mock.patch" },
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
            const matched = MOCK_PATTERNS.find((m) => m.pattern.test(rawLine));

            if (matched) {
              const lineNum = change.ln || chunk.newStart;

              findings.push({
                id: `fnd-mock-${filePath}-${lineNum}`,
                ruleId: this.id,
                title: "Mock Substitution Injected",
                summary: `New mock definition '${matched.label}' was introduced in ${filePath}.`,
                severity: this.defaultSeverity,
                source: "static-rule",
                evidence: [
                  {
                    filePath,
                    startLine: lineNum,
                    endLine: lineNum,
                    title: `Mock added: ${matched.label}`,
                    detail: `Line added: "${rawLine.trim()}"`,
                    afterSnippet: rawLine.trim(),
                    diffHunk: chunk.content,
                  },
                ],
                reproductionCommand: `git diff ${filePath}`,
                humanAction:
                  "Review whether mock replaces the actual unit under test (tautological test).",
                limitations: [
                  "Mocking external I/O is standard practice; replay verification confirms if protected invariant still holds.",
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
