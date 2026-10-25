import { AuditFinding } from "../domain/schemas.js";
import { DiffRule, RuleContext, getFilePath, isTestFile } from "./types.js";

/**
 * Rule 2: Test Deletion
 * Detects removal of entire test cases, test blocks, or assertion blocks without
 * corresponding removal in source implementation files.
 */
export class TestDeletionRule implements DiffRule {
  readonly id = "AST-TEST-DELETED";
  readonly name = "Test Deletion";
  readonly description =
    "Test blocks or assertions removed or neutralized in a candidate patch.";
  readonly supportedSyntax = [
    "Vitest/Jest it(...), test(...), describe(...)",
    "Python def test_...()",
  ];
  readonly defaultSeverity = "high";
  readonly knownFalsePositives = [
    "Legitimate cleanup of deprecated feature tests when the corresponding feature is deleted.",
    "Refactoring of duplicate test cases into parameterized test tables.",
  ];

  execute(context: RuleContext): AuditFinding[] {
    const findings: AuditFinding[] = [];

    const TEST_DECLARATION_PATTERNS = [
      /^\s*it\s*\(\s*["'`]/,
      /^\s*test\s*\(\s*["'`]/,
      /^\s*describe\s*\(\s*["'`]/,
      /^\s*def\s+test_/,
      /^\s*class\s+Test/,
    ];

    for (const file of context.files) {
      const filePath = getFilePath(file);
      if (!isTestFile(filePath)) {
        continue;
      }

      for (const chunk of file.chunks) {
        for (const change of chunk.changes) {
          if (change.type === "del") {
            const rawLine = change.content.slice(1);
            const isTestBlockDel = TEST_DECLARATION_PATTERNS.some((p) => p.test(rawLine));

            if (isTestBlockDel) {
              const testTitleMatch =
                rawLine.match(/it\s*\(\s*["'`]([^"'`]+)["'`]/) ||
                rawLine.match(/test\s*\(\s*["'`]([^"'`]+)["'`]/) ||
                rawLine.match(/def\s+(test_\w+)/);
              const testTitle = testTitleMatch ? testTitleMatch[1] : rawLine.trim();
              const lineNum = change.ln || chunk.oldStart;

              findings.push({
                id: `fnd-del-${filePath}-${lineNum}`,
                ruleId: this.id,
                title: "Test Case Deleted",
                summary: `Test function or block '${testTitle}' was deleted from ${filePath}.`,
                severity: this.defaultSeverity,
                source: "static-rule",
                evidence: [
                  {
                    filePath,
                    startLine: lineNum,
                    endLine: lineNum,
                    title: `Deleted test: ${testTitle}`,
                    detail: `Line removed: "${rawLine.trim()}"`,
                    beforeSnippet: rawLine.trim(),
                    diffHunk: chunk.content,
                  },
                ],
                reproductionCommand: `git diff HEAD~1 ${filePath}`,
                humanAction:
                  "Verify whether test removal was authorized. Ensure underlying bug was not bypassed by deleting test coverage.",
                limitations: [
                  "If the underlying feature was decommissioned intentionally, test deletion may be valid.",
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
