export interface EntireRawRecord {
  checkpointId?: string;
  timestamp?: string;
  commitHash?: string;
  source?: string;
  prompt?: string;
  userPrompt?: string;
  command?: string;
  tool?: string;
  file?: string;
  targetFile?: string;
  linesChanged?: number[];
  diff?: string;
  diffSnippet?: string;
  testOutcome?: "passed" | "failed" | "skipped";
  testPassed?: boolean;
  rawTranscript?: string;
  [key: string]: unknown;
}

export interface EntireProviderOptions {
  /**
   * Secret redaction enabled by default.
   */
  redactSecrets?: boolean;
  /**
   * File paths or glob-like substrings to exclude from events.
   */
  excludePaths?: string[];
  /**
   * Substrings or phrases to exclude from prompt/transcript summaries.
   */
  excludeContentPatterns?: (string | RegExp)[];
  /**
   * When false (default), raw transcripts are dropped from memory and storage.
   */
  persistFullTranscripts?: boolean;
}

export interface SessionQueryResult {
  isLive: boolean;
  sourceLabel: string;
  sessionId?: string;
  events: import("../domain/schemas.js").SessionEvent[];
  warning?: string;
  setupGuide?: {
    title: string;
    steps: string[];
    documentationUrl: string;
  };
}
