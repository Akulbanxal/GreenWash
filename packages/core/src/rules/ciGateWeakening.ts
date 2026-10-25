import { AuditFinding } from "../domain/schemas.js";
import { DiffRule, RuleContext, getFilePath, isCiFile } from "./types.js";

/**
 * Rule 5: CI Gate Weakening
 * Detects tampering with CI workflows: continue-on-error: true, || true,
 * test threshold reduction, or removal of test/lint commands.
 */
export class CiGateWeakeningRule implements DiffRule {
  readonly id = "CI-GATE-SUPPRESSION";
  readonly name = "CI Gate Weakening";
  readonly description =
    "CI quality gates altered via continue-on-error, error suppression (|| true), or lowered quality thresholds.";
  readonly supportedSyntax = [
    "GitHub Actions .github/workflows/*.yml",
    "continue-on-error: true",
    "command || true",
    "coverage threshold reduction",
  ];
  readonly defaultSeverity = "critical";
  readonly knownFalsePositives = [
    "Experimental matrix builds deliberately marked continue-on-error (e.g. node-nightly).",
  ];

  execute(context: RuleContext): AuditFinding[] {
    const findings: AuditFinding[] = [];

    const SUPPRESSION_PATTERNS = [
      { pattern: /continue-on-error:\s*true/, label: "continue-on-error: true" },
      { pattern: /\|\s*true\b/, label: "shell error suppression (|| true)" },
      { pattern: /\|\|\s*exit\s*0/, label: "shell exit 0 override (|| exit 0)" },
    ];

    const THRESHOLD_REDUCE_REGEX = /--min-coverage=(\d+)/;

    for (const file of context.files) {
      const filePath = getFilePath(file);
      if (!isCiFile(filePath)) {
        continue;
      }

      for (const chunk of file.chunks) {
        // Check 1: Error suppression added
        for (const change of chunk.changes) {
          if (change.type === "add") {
            const rawLine = change.content.slice(1);
            const matched = SUPPRESSION_PATTERNS.find((s) => s.pattern.test(rawLine));

            if (matched) {
              const lineNum = change.ln || chunk.newStart;

              findings.push({
                id: `fnd-ci-suppress-${filePath}-${lineNum}`,
                ruleId: this.id,
                title: "CI Check Error Suppression Introduced",
                summary: `Quality gate step in ${filePath} added '${matched.label}'.`,
                severity: this.defaultSeverity,
                source: "static-rule",
                evidence: [
                  {
                    filePath,
                    startLine: lineNum,
                    endLine: lineNum,
                    title: `CI suppression: ${matched.label}`,
                    detail: `Line added: "${rawLine.trim()}"`,
                    afterSnippet: rawLine.trim(),
                    diffHunk: chunk.content,
                  },
                ],
                reproductionCommand: `git diff ${filePath}`,
                humanAction:
                  "Reject CI workflow tampering. Test failures must block CI pipeline.",
                limitations: [
                  "Experimental nightly matrix jobs might legitimately set continue-on-error.",
                ],
              });
            }
          }
        }

        // Check 2: Quality/Coverage threshold lowered
        let oldThreshold: number | null = null;
        let newThreshold: number | null = null;
        let thresholdLine = chunk.newStart;

        for (const change of chunk.changes) {
          if (change.type === "del") {
            const m = change.content.match(THRESHOLD_REDUCE_REGEX);
            if (m) {
              oldThreshold = parseInt(m[1], 10);
            }
          } else if (change.type === "add") {
            const m = change.content.match(THRESHOLD_REDUCE_REGEX);
            if (m) {
              newThreshold = parseInt(m[1], 10);
              thresholdLine = change.ln || chunk.newStart;
            }
          }
        }

        if (oldThreshold !== null && newThreshold !== null && newThreshold < oldThreshold) {
          findings.push({
            id: `fnd-ci-threshold-${filePath}-${thresholdLine}`,
            ruleId: "CI-THRESHOLD-REDUCED",
            title: "Coverage Threshold Lowered",
            summary: `Coverage requirement in ${filePath} was lowered from ${oldThreshold}% to ${newThreshold}%.`,
            severity: "high",
            source: "static-rule",
            evidence: [
              {
                filePath,
                startLine: thresholdLine,
                endLine: thresholdLine,
                title: "Coverage threshold decreased",
                detail: `Previous: ${oldThreshold}% -> New: ${newThreshold}%`,
                beforeSnippet: `--min-coverage=${oldThreshold}`,
                afterSnippet: `--min-coverage=${newThreshold}`,
                diffHunk: chunk.content,
              },
            ],
            expected: `${oldThreshold}%`,
            actual: `${newThreshold}%`,
            reproductionCommand: `git diff ${filePath}`,
            humanAction:
              "Restore coverage threshold. Do not lower testing standards to pass CI.",
            limitations: [],
          });
        }
      }
    }

    return findings;
  }
}
