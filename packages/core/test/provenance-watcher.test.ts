import { describe, it, expect, vi, afterEach } from "vitest";
import { EntireSessionWatcher } from "../src/provenance/watcher.js";
import { SessionEvent } from "../src/domain/schemas.js";

describe("EntireSessionWatcher Unit Tests", () => {
  let watcher: EntireSessionWatcher;

  afterEach(() => {
    if (watcher) {
      watcher.stop();
    }
  });

  it("simulates live agent session stream and emits typed events", async () => {
    watcher = new EntireSessionWatcher();

    const sampleEvents: SessionEvent[] = [
      {
        id: "evt-1",
        timestamp: "2026-10-23T10:00:00.000Z",
        type: "prompt",
        source: "entire-cli",
        summary: "User requested: Fix discount bug",
        isFlagged: false,
      },
      {
        id: "evt-2",
        timestamp: "2026-10-23T10:00:05.000Z",
        type: "file_edit",
        source: "entire-cli",
        summary: "Edited tests/discount.test.ts",
        targetFile: "tests/discount.test.ts",
        isFlagged: true,
        flagReason: "Softened assertion",
      },
      {
        id: "evt-3",
        timestamp: "2026-10-23T10:00:10.000Z",
        type: "checkpoint",
        source: "entire-cli",
        summary: "Entire Checkpoint 4f8e9a",
        isFlagged: false,
      },
    ];

    const receivedEvents: SessionEvent[] = [];
    watcher.on("event", (evt) => {
      receivedEvents.push(evt);
    });

    let completed = false;
    watcher.on("status", (status) => {
      if (status.state === "stream_completed") {
        completed = true;
      }
    });

    watcher.simulateStream(sampleEvents, 20);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(receivedEvents.length).toBe(3);
    expect(receivedEvents[0].summary).toBe("User requested: Fix discount bug");
    expect(receivedEvents[1].isFlagged).toBe(true);
    expect(completed).toBe(true);
  });

  it("emits status state when started and stopped", () => {
    watcher = new EntireSessionWatcher();
    const statuses: any[] = [];

    watcher.on("status", (s) => statuses.push(s));
    watcher.startWatching("/tmp/nonexistent-session.log");
    expect(statuses[0].state).toBe("watching");

    watcher.stop();
    expect(statuses[1].state).toBe("stopped");
  });
});
