import parseDiff from "parse-diff";

export interface ParsedDiffLine {
  type: "normal" | "add" | "del";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface ParsedDiffFile {
  from?: string;
  to?: string;
  filePath: string;
  additions: number;
  deletions: number;
  lines: ParsedDiffLine[];
}

export function parseUnifiedDiffText(rawDiff: string): ParsedDiffFile[] {
  if (!rawDiff || typeof rawDiff !== "string") {
    return [];
  }

  try {
    const files = parseDiff(rawDiff);
    return files.map((f) => {
      const filePath = (f.to && f.to !== "/dev/null" ? f.to : f.from || "unknown").replace(/^[ab]\//, "");
      const lines: ParsedDiffLine[] = [];

      for (const chunk of f.chunks) {
        for (const change of chunk.changes) {
          const ch = change as any;
          lines.push({
            type: change.type,
            oldLineNumber: change.type === "del" ? ch.ln : change.type === "normal" ? ch.ln1 : undefined,
            newLineNumber: change.type === "add" ? ch.ln : change.type === "normal" ? ch.ln2 : undefined,
            content: change.content.slice(1),
          });
        }
      }

      return {
        from: f.from,
        to: f.to,
        filePath,
        additions: f.additions,
        deletions: f.deletions,
        lines,
      };
    });
  } catch {
    return [];
  }
}
