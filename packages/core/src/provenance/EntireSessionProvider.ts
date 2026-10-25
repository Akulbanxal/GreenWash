import fs from "node:fs";
import path from "node:path";
import { SessionEvent, SessionEventSchema } from "../domain/schemas.js";
import { EntireProviderOptions, EntireRawRecord, SessionQueryResult } from "./types.js";
import { traceAuditStep } from "../sentry/index.js";
import { resolveFixturePath } from "../fixtures/loader.js";

/**
 * Standard patterns to scrub from prompt & command text
 */
const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret|token|password|auth|bearer)[\s:=("']{1,4}([a-zA-Z0-9_\-]{8,})/gi,
  /ghp_[a-zA-Z0-9]{20,}/g,
  /sk-[a-zA-Z0-9]{20,}/g,
  /ey[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{5,}/g, // JWT
  /AKIA[0-9A-Z]{16}/g, // AWS Access Key
];

export function redactSecrets(text: string): string {
  let sanitized = text;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match, captured) => {
      if (captured) {
        return match.replace(captured, "[REDACTED_SECRET]");
      }
      return "[REDACTED_SECRET]";
    });
  }
  return sanitized;
}

export class EntireSessionProvider {
  private readonly options: EntireProviderOptions;

  constructor(options?: EntireProviderOptions) {
    this.options = {
      redactSecrets: options?.redactSecrets ?? true,
      excludePaths: options?.excludePaths ?? [],
      excludeContentPatterns: options?.excludeContentPatterns ?? [],
      persistFullTranscripts: options?.persistFullTranscripts ?? false,
    };
  }

  /**
   * Normalizes raw Entire CLI / agent session records into validated SessionEvent items.
   * Handles secret redaction, path exclusions, transcript exclusions, and suspicious pattern flags.
   */
  normalizeRecords(rawRecords: EntireRawRecord[]): SessionEvent[] {
    if (!Array.isArray(rawRecords)) {
      return [];
    }

    const events: SessionEvent[] = [];

    for (let i = 0; i < rawRecords.length; i++) {
      const record = rawRecords[i];
      if (!record || typeof record !== "object") {
        continue;
      }

      const targetFile = (record.targetFile || record.file || undefined) as string | undefined;

      // 1. Exclude paths if user requested
      if (targetFile && this.options.excludePaths && this.options.excludePaths.length > 0) {
        const isExcluded = this.options.excludePaths.some((p) => targetFile.includes(p));
        if (isExcluded) {
          continue;
        }
      }

      // 2. Extract or infer event type
      let type: SessionEvent["type"] = "tool_execution";
      if (record.prompt || record.userPrompt) {
        type = "prompt";
      } else if (record.testOutcome !== undefined || record.testPassed !== undefined) {
        type = "test_run";
      } else if (record.diffSnippet || record.diff || (targetFile && record.linesChanged)) {
        type = "file_edit";
      } else if (record.commitHash) {
        type = "commit";
      } else if (record.checkpointId) {
        type = "checkpoint";
      }

      // 3. Construct summary
      let summary = "";
      if (type === "prompt") {
        summary = (record.prompt || record.userPrompt || "Agent Prompt") as string;
      } else if (type === "test_run") {
        const outcome = record.testOutcome || (record.testPassed ? "passed" : "failed");
        summary = `Test suite execution: ${outcome.toUpperCase()}${record.command ? ` ($ ${record.command})` : ""}`;
      } else if (type === "file_edit") {
        summary = `Edited ${targetFile || "file"}${record.linesChanged ? ` (lines: ${record.linesChanged.join(", ")})` : ""}`;
      } else if (type === "commit") {
        summary = `Committed change ${record.commitHash ? `(${record.commitHash.slice(0, 7)})` : ""}`;
      } else if (type === "checkpoint") {
        summary = `Entire Checkpoint ${record.checkpointId || ""}`;
      } else {
        summary = (record.command || record.tool || "Agent action") as string;
      }

      // 4. Redact secrets if enabled
      if (this.options.redactSecrets) {
        summary = redactSecrets(summary);
      }

      // 5. Exclude content if matching patterns
      if (this.options.excludeContentPatterns && this.options.excludeContentPatterns.length > 0) {
        const matchesExclude = this.options.excludeContentPatterns.some((pattern) => {
          if (typeof pattern === "string") {
            return summary.includes(pattern);
          }
          return pattern.test(summary);
        });
        if (matchesExclude) {
          continue;
        }
      }

      // 6. Scrub raw transcripts unless explicitly opted in
      let details: Record<string, unknown> | undefined = undefined;
      if (record.details && typeof record.details === "object") {
        details = { ...(record.details as Record<string, unknown>) };
      }
      if (record.rawTranscript) {
        if (this.options.persistFullTranscripts) {
          details = { ...details, rawTranscript: this.options.redactSecrets ? redactSecrets(record.rawTranscript) : record.rawTranscript };
        }
        // If false, explicitly dropped!
      }

      // Ensure valid ISO timestamp
      let timestamp = new Date().toISOString();
      if (record.timestamp) {
        try {
          const parsed = new Date(record.timestamp);
          if (!isNaN(parsed.getTime())) {
            timestamp = parsed.toISOString();
          }
        } catch {}
      }

      const eventId = `ev-${i + 1}-${record.checkpointId || "gen"}`;

      const rawEvent: SessionEvent = {
        id: eventId,
        timestamp,
        type,
        source: (record.source as string) || "Entire CLI",
        summary,
        details,
        targetFile,
        linesChanged: Array.isArray(record.linesChanged) ? record.linesChanged : undefined,
        diffSnippet: record.diffSnippet || record.diff || undefined,
        command: (record.command as string) || undefined,
        testOutcome: record.testOutcome
          ? (record.testOutcome as "passed" | "failed" | "skipped")
          : record.testPassed !== undefined
            ? record.testPassed
              ? "passed"
              : "failed"
            : undefined,
        checkpointId: (record.checkpointId as string) || undefined,
        commitHash: (record.commitHash as string) || undefined,
        isFlagged: false,
      };

      const parsed = SessionEventSchema.safeParse(rawEvent);
      if (parsed.success) {
        events.push(parsed.data);
      }
    }

    // 7. Highlight suspicious sequence patterns (e.g. test failure -> test-file edit -> passing suite)
    this.annotateSuspiciousSequences(events);

    traceAuditStep(
      "Entire Data Parsing",
      "audit.step.entire_data_parsing",
      {
        stepName: "entire-session-parsing",
        checkType: "entire_provenance",
        findingsCount: events.length,
      },
      async (span) => {
        span?.setAttribute("audit.events_count", events.length);
        span?.setAttribute("audit.result_status", "success");
      }
    ).catch(() => {});

    return events;
  }

  /**
   * Evaluates sequence patterns that warrant human review (not proof of malice).
   * Specifically: test failure -> test-file edit -> passing suite
   */
  private annotateSuspiciousSequences(events: SessionEvent[]): void {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];

      // Check if current event is a failed test run
      if (ev.type === "test_run" && ev.testOutcome === "failed") {
        // Look ahead for an edit to a test file
        for (let j = i + 1; j < events.length; j++) {
          const nextEv = events[j];
          const isTestFileEdit =
            nextEv.type === "file_edit" &&
            nextEv.targetFile &&
            (nextEv.targetFile.includes("test") || nextEv.targetFile.includes("spec"));

          if (isTestFileEdit) {
            // Look further ahead for a passing test suite
            for (let k = j + 1; k < events.length; k++) {
              const passEv = events[k];
              if (passEv.type === "test_run" && passEv.testOutcome === "passed") {
                // Annotate the pattern: suspicious review recommendation
                nextEv.isFlagged = true;
                nextEv.flagReason =
                  "Suspicious Pattern: Test failed, followed by an edit to test file rather than source code, followed by green pass. Warrants review.";
                passEv.isFlagged = true;
                passEv.flagReason =
                  "Suspicious Pattern: Suite turned green immediately after test code modification.";
                break;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Loads session from checked-in sanitized sample dataset.
   */
  loadSampleSession(sampleFilePath?: string): SessionQueryResult {
    const resolvedPath =
      sampleFilePath ||
      resolveFixturePath("fixtures/sessions/sanitized-sample-session.json");

    if (fs.existsSync(resolvedPath)) {
      try {
        const rawContent = fs.readFileSync(resolvedPath, "utf-8");
        const parsed = JSON.parse(rawContent);
        const records: EntireRawRecord[] = Array.isArray(parsed) ? parsed : parsed.records || [];
        const events = this.normalizeRecords(records);
        return {
          isLive: false,
          sourceLabel: "Sample session — not a live connection",
          sessionId: (parsed.sessionId as string) || "sample-session-billing-evasion",
          events,
          warning: "Displaying checked-in sanitized sample session. No active Entire CLI connection detected.",
          setupGuide: this.getSetupGuide(),
        };
      } catch {}
    }

    // Default built-in fallback sample if file missing
    return {
      isLive: false,
      sourceLabel: "Sample session — not a live connection",
      sessionId: "sample-session-billing-evasion",
      events: this.getDefaultSampleEvents(),
      warning: "Displaying checked-in sanitized sample session. No active Entire CLI connection detected.",
      setupGuide: this.getSetupGuide(),
    };
  }

  getSetupGuide() {
    return {
      title: "Connect Entire CLI Provenance",
      steps: [
        "1. Install Entire CLI: npm install -g entireio/cli (or go install github.com/entireio/cli@latest)",
        "2. Initialize Entire in your repository: entire enable",
        "3. Run your coding agent with checkpoint tracking: entire run --agent <agent-name>",
        "4. Set environment variable ENTIRE_SESSION_PATH in Greenwash API server to point to your repository or checkpoints branch",
      ],
      documentationUrl: "https://entire.io/docs",
    };
  }

  private getDefaultSampleEvents(): SessionEvent[] {
    const sampleRecords: EntireRawRecord[] = [
      {
        checkpointId: "01JBMX9001A",
        timestamp: "2026-10-22T14:02:11Z",
        source: "Entire CLI (Claude Code)",
        prompt: "Fix intermittent discount calculation error on enterprise tiers with API key ghp_SAMPLESECRETKEY1234567890",
      },
      {
        checkpointId: "01JBMX9002B",
        timestamp: "2026-10-22T14:02:18Z",
        source: "vitest runner",
        command: "vitest run tests/discount.test.ts",
        testOutcome: "failed",
        targetFile: "tests/discount.test.ts",
      },
      {
        checkpointId: "01JBMX9003C",
        timestamp: "2026-10-22T14:02:35Z",
        source: "agent editor",
        targetFile: "tests/discount.test.ts",
        linesChanged: [8],
        diffSnippet: "- expect(discounted).toBe(900);\n+ expect(discounted).toBeGreaterThanOrEqual(0);",
      },
      {
        checkpointId: "01JBMX9004D",
        timestamp: "2026-10-22T14:02:42Z",
        source: "vitest runner",
        command: "vitest run tests/discount.test.ts",
        testOutcome: "passed",
        targetFile: "tests/discount.test.ts",
      },
      {
        checkpointId: "01JBMX9005E",
        timestamp: "2026-10-22T14:02:50Z",
        source: "git commit",
        commitHash: "c84f91a27e3d81b2a4e9",
        targetFile: "tests/discount.test.ts",
      },
    ];

    return this.normalizeRecords(sampleRecords);
  }
}
