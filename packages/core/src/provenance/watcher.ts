import { EventEmitter } from "node:events";
import fs from "node:fs";
import { SessionEvent } from "../domain/schemas.js";
import { EntireSessionProvider } from "./EntireSessionProvider.js";
import { EntireProviderOptions, EntireRawRecord } from "./types.js";

export interface WatcherOptions extends EntireProviderOptions {
  pollingIntervalMs?: number;
}

/**
 * EntireSessionWatcher:
 * Emits real-time agent provenance events from live agent log streams.
 * Can monitor live files or simulate live streaming for demonstration.
 */
export class EntireSessionWatcher extends EventEmitter {
  private filePath?: string;
  private provider: EntireSessionProvider;
  private isWatching = false;
  private lastBytePosition = 0;
  private pollInterval?: NodeJS.Timeout;
  private pollingMs: number;

  constructor(options?: WatcherOptions) {
    super();
    this.provider = new EntireSessionProvider(options);
    this.pollingMs = options?.pollingIntervalMs ?? 500;
  }

  /**
   * Start watching a live agent session log file.
   */
  startWatching(filePath: string): void {
    if (this.isWatching) {
      this.stop();
    }

    this.filePath = filePath;
    this.isWatching = true;
    this.lastBytePosition = 0;

    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        this.lastBytePosition = stats.size;
      } catch {
        this.lastBytePosition = 0;
      }
    }

    this.emit("status", { state: "watching", filePath });

    // Poll for new byte chunks appended to the session log
    this.pollInterval = setInterval(() => {
      this.checkFileUpdates();
    }, this.pollingMs);
  }

  /**
   * Check for newly appended content in the watched file.
   */
  private checkFileUpdates(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const stats = fs.statSync(this.filePath);
      if (stats.size > this.lastBytePosition) {
        const buffer = Buffer.alloc(stats.size - this.lastBytePosition);
        const fd = fs.openSync(this.filePath, "r");
        fs.readSync(fd, buffer, 0, buffer.length, this.lastBytePosition);
        fs.closeSync(fd);

        this.lastBytePosition = stats.size;
        const newText = buffer.toString("utf-8");

        // Parse lines as JSONL or JSON chunks
        const lines = newText.split("\n").filter((l) => l.trim().length > 0);
        for (const line of lines) {
          try {
            const rawRecord: EntireRawRecord = JSON.parse(line);
            const events = this.provider.normalizeRecords([rawRecord]);
            for (const event of events) {
              this.emit("event", event);
            }
          } catch {
            // Ignore partial non-JSON line fragments
          }
        }
      }
    } catch (err: unknown) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Stop watching active session file.
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    this.isWatching = false;
    this.emit("status", { state: "stopped" });
  }

  /**
   * Helper to simulate a live agent session stream for testing and web SSE demonstrations.
   */
  simulateStream(
    events?: SessionEvent[],
    intervalMs = 150
  ): { cancel: () => void } {
    const list = events && events.length > 0 ? events : this.provider.loadSampleSession().events;
    let index = 0;
    const timer = setInterval(() => {
      if (index < list.length) {
        this.emit("event", list[index++]);
      } else {
        clearInterval(timer);
        this.emit("status", { state: "stream_completed" });
      }
    }, intervalMs);

    return {
      cancel: () => clearInterval(timer),
    };
  }
}
