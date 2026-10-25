import { AuditFinding, EvidenceReference, FindingSeverity } from "../domain/schemas.js";
import { DiffRule, RuleContext } from "./types.js";

export interface PythonScanResult {
  findings: AuditFinding[];
  checksCount: number;
}

export class PythonIntegrityRule implements DiffRule {
  readonly id = "PY-INTEGRITY-RULES";
  readonly name = "Python & Pytest Test Integrity";
  readonly description = "Scans Python test changes for assertion softening, skip markers, and test removals.";
  readonly supportedSyntax = ["Python 3.x", "pytest", "unittest"];
  readonly defaultSeverity: FindingSeverity = "critical";
  readonly knownFalsePositives = [
    "Intentional refactoring of helper test methods",
    "Marking tests skip with explicit Jira/GitHub issue link",
  ];

  private readonly scanner = new PythonDiffScanner();

  execute(context: RuleContext): AuditFinding[] {
    return this.scanner.scan(context.rawDiff).findings;
  }
}

/**
 * Deterministic Python / pytest diff scanner.
 * Scans unified diffs modifying Python test files (.py) for:
 * 1. Loosened assertion operators (PY-ASSERT-WEAKENED)
 * 2. Injected pytest skip markers (PY-TEST-SKIPPED)
 * 3. Deleted test functions (PY-TEST-DELETED)
 */
export class PythonDiffScanner {
  scan(rawDiff: string): PythonScanResult {
    const findings: AuditFinding[] = [];
    const files = this.splitDiffIntoFiles(rawDiff);

    for (const file of files) {
      if (!this.isPythonTestFile(file.path)) {
        continue;
      }

      this.checkAssertionWeakening(file, findings);
      this.checkTestSkipping(file, findings);
      this.checkTestDeletion(file, findings);
    }

    return {
      findings,
      checksCount: 3,
    };
  }

  private isPythonTestFile(path: string): boolean {
    const lower = path.toLowerCase();
    return (
      lower.endsWith(".py") &&
      (lower.includes("test") || lower.includes("tests") || lower.includes("spec"))
    );
  }

  private splitDiffIntoFiles(
    rawDiff: string
  ): Array<{ path: string; addedLines: string[]; deletedLines: string[]; hunks: string[] }> {
    const files: Array<{
      path: string;
      addedLines: string[];
      deletedLines: string[];
      hunks: string[];
    }> = [];

    const fileChunks = rawDiff.split(/^diff --git /m);
    for (const chunk of fileChunks) {
      if (!chunk.trim()) continue;

      const pathMatch = chunk.match(/--- a\/(.+?)\n\+\+\+ b\/(.+?)\n/);
      const filePath = pathMatch ? pathMatch[2] : "unknown.py";

      const addedLines: string[] = [];
      const deletedLines: string[] = [];
      const hunks: string[] = [];

      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("@@")) {
          hunks.push(line);
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          addedLines.push(line.slice(1));
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          deletedLines.push(line.slice(1));
        }
      }

      files.push({ path: filePath, addedLines, deletedLines, hunks });
    }

    return files;
  }

  private checkAssertionWeakening(
    file: { path: string; addedLines: string[]; deletedLines: string[]; hunks: string[] },
    findings: AuditFinding[]
  ): void {
    // Exact equality in deleted: assert x == 900
    const strictAssertRegex = /assert\s+([a-zA-Z0-9_().]+)\s*==\s*([0-9a-zA-Z"'-]+)/;
    // Permissive relational in added: assert x >= 0 or assert x != -1
    const permissiveAssertRegex = /assert\s+([a-zA-Z0-9_().]+)\s*(?:>=|>|!=|is\s+not\s+None)/;

    for (const delLine of file.deletedLines) {
      const strictMatch = delLine.match(strictAssertRegex);
      if (!strictMatch) continue;

      const delSubject = strictMatch[1];
      const delExpected = strictMatch[2];

      for (const addLine of file.addedLines) {
        const permMatch = addLine.match(permissiveAssertRegex);
        if (permMatch && (permMatch[1] === delSubject || addLine.includes("assert "))) {
          const evidence: EvidenceReference = {
            filePath: file.path,
            title: "Python assertion operator weakened",
            detail: `Strict equality 'assert ${delSubject} == ${delExpected}' was replaced by permissive '${addLine.trim()}'.`,
            beforeSnippet: delLine.trim(),
            afterSnippet: addLine.trim(),
          };

          findings.push({
            id: `finding-py-weakened-${findings.length + 1}`,
            ruleId: "PY-ASSERT-WEAKENED",
            title: "Weakened Python Test Assertion",
            summary: `Agent weakened strict pytest assertion in ${file.path} to accept non-discriminating outcomes.`,
            severity: "critical",
            source: "static-rule",
            evidence: [evidence],
            expected: delExpected,
            actual: addLine.trim(),
            reproductionCommand: `pytest ${file.path}`,
            humanAction: "Restore the strict expected value comparison in test assertion.",
            limitations: ["Requires explicit knowledge of business logic expected outputs"],
          });
          break;
        }
      }
    }
  }

  private checkTestSkipping(
    file: { path: string; addedLines: string[] },
    findings: AuditFinding[]
  ): void {
    const skipMarkers = [
      "@pytest.mark.skip",
      "@pytest.mark.skipif",
      "pytest.skip(",
      "@unittest.skip",
    ];

    for (const line of file.addedLines) {
      for (const marker of skipMarkers) {
        if (line.includes(marker)) {
          findings.push({
            id: `finding-py-skip-${findings.length + 1}`,
            ruleId: "PY-TEST-SKIPPED",
            title: "Injected Python Test Skip Modifier",
            summary: `Agent added skip modifier '${marker}' to bypass failing Python test in ${file.path}.`,
            severity: "critical",
            source: "static-rule",
            evidence: [
              {
                filePath: file.path,
                title: "Injected pytest skip marker",
                detail: `Line contains '${marker}' which halts test execution during CI.`,
                afterSnippet: line.trim(),
              },
            ],
            reproductionCommand: `pytest ${file.path}`,
            humanAction: "Remove the skip directive and resolve the underlying failure before merging.",
            limitations: ["Does not check if the test is obsolete"],
          });
          break;
        }
      }
    }
  }

  private checkTestDeletion(
    file: { path: string; addedLines: string[]; deletedLines: string[] },
    findings: AuditFinding[]
  ): void {
    for (const delLine of file.deletedLines) {
      if (/^\s*def\s+test_[a-zA-Z0-9_]+\s*\(/.test(delLine)) {
        const testNameMatch = delLine.match(/def\s+(test_[a-zA-Z0-9_]+)/);
        const testName = testNameMatch ? testNameMatch[1] : "test";

        // Check if renamed or preserved in added lines
        const stillPresent = file.addedLines.some((l) => l.includes(testName));
        if (!stillPresent) {
          findings.push({
            id: `finding-py-deleted-${findings.length + 1}`,
            ruleId: "PY-TEST-DELETED",
            title: "Deleted Python Test Function",
            summary: `Agent deleted pytest test function '${testName}' from ${file.path} to evade test failure.`,
            severity: "critical",
            source: "static-rule",
            evidence: [
              {
                filePath: file.path,
                title: `Deleted test ${testName}`,
                detail: `Function '${testName}' was removed from test file.`,
                beforeSnippet: delLine.trim(),
              },
            ],
            reproductionCommand: `pytest ${file.path}`,
            humanAction: "Restore the deleted test function and fix the race condition or bug.",
            limitations: ["Does not generate replacement tests automatically"],
          });
        }
      }
    }
  }
}
