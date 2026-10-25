import { AuditFinding } from "../domain/schemas.js";
import { DiffRule, RuleContext, getFilePath } from "./types.js";

/**
 * Rule 6: Contract Modification
 * Detects any attempt by candidate diff to modify protected contract definitions
 * or baselines without explicit reviewed out-of-band operation.
 */
export class ContractModificationRule implements DiffRule {
  readonly id = "CONTRACT-MODIFIED";
  readonly name = "Protected Contract Modification";
  readonly description =
    "A proposed patch attempts to modify protected behavioral contracts or baseline files.";
  readonly supportedSyntax = [
    "fixtures/contracts/*.json",
    "contracts/**/*.json",
    "*.contract.json",
  ];
  readonly defaultSeverity = "critical";
  readonly knownFalsePositives = [];

  execute(context: RuleContext): AuditFinding[] {
    const findings: AuditFinding[] = [];

    const isContractPath = (filePath: string): boolean => {
      return (
        filePath.includes("contract") ||
        filePath.endsWith(".contract.json") ||
        Boolean(context.contractPaths?.some((cp) => filePath.includes(cp)))
      );
    };

    for (const file of context.files) {
      const filePath = getFilePath(file);
      if (!isContractPath(filePath)) {
        continue;
      }

      // Any additions or deletions in contract files
      if (file.chunks.length > 0) {
        const firstChunk = file.chunks[0];
        const lineNum = firstChunk.newStart || 1;

        findings.push({
          id: `fnd-contract-mod-${filePath}-${lineNum}`,
          ruleId: this.id,
          title: "Protected Contract Tampered",
          summary: `Proposed code modifies baseline contract file '${filePath}'.`,
          severity: this.defaultSeverity,
          source: "static-rule",
          evidence: [
            {
              filePath,
              startLine: lineNum,
              endLine: lineNum,
              title: "Contract file modified by candidate patch",
              detail: `Candidate patch modified protected behavior contract ${filePath}.`,
              diffHunk: firstChunk.content,
            },
          ],
          reproductionCommand: `git diff ${filePath}`,
          humanAction:
            "Reject patch immediately. Candidate patches cannot rewrite their own behavior specifications.",
          limitations: [
            "Contract version updates must occur through a separate reviewed governance process.",
          ],
        });
      }
    }

    return findings;
  }
}
