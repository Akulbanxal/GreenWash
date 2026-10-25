import parseDiff, { File as ParsedFile, Chunk as ParsedChunk, Change as ParsedChange } from "parse-diff";
import { AuditFinding, FindingSeverity } from "../domain/schemas.js";

export type { ParsedFile, ParsedChunk, ParsedChange };

export interface RuleContext {
  files: ParsedFile[];
  rawDiff: string;
  contractPaths?: string[];
}

export interface DiffRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly supportedSyntax: string[];
  readonly defaultSeverity: FindingSeverity;
  readonly knownFalsePositives: string[];
  execute(context: RuleContext): AuditFinding[];
}

/**
 * Safely parses raw unified diff string into structured file hunks.
 */
export function safeParseDiff(rawDiff: string): ParsedFile[] {
  if (!rawDiff || typeof rawDiff !== "string") {
    return [];
  }
  try {
    return parseDiff(rawDiff);
  } catch (err) {
    return [];
  }
}

/**
 * Helper to get clean file path from a parsed diff file.
 */
export function getFilePath(file: ParsedFile): string {
  if (file.to && file.to !== "/dev/null") {
    return file.to.replace(/^[ab]\//, "");
  }
  if (file.from && file.from !== "/dev/null") {
    return file.from.replace(/^[ab]\//, "");
  }
  return "unknown-file";
}

/**
 * Checks if a file path is a test or spec file.
 */
export function isTestFile(filePath: string): boolean {
  return (
    filePath.includes("test") ||
    filePath.includes("spec") ||
    filePath.endsWith(".test.ts") ||
    filePath.endsWith(".test.js") ||
    filePath.endsWith(".spec.ts") ||
    filePath.endsWith(".spec.js") ||
    filePath.endsWith(".test.py") ||
    filePath.endsWith("_test.py")
  );
}

/**
 * Checks if a file path is a CI workflow file.
 */
export function isCiFile(filePath: string): boolean {
  return (
    filePath.includes(".github/workflows") ||
    filePath.includes(".gitlab-ci") ||
    filePath.endsWith(".circleci/config.yml")
  );
}
