import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Isolated child worker process.
 * Receives execution instructions via IPC, dynamically imports candidate module,
 * executes target function with input parameters, and returns result.
 */
process.on("message", async (msg: { sourceFilePath: string; targetFunction: string; input: unknown }) => {
  try {
    const { sourceFilePath, targetFunction, input } = msg;

    // Convert file path to file:// URL for ESM dynamic import
    const fileUrl = pathToFileURL(sourceFilePath).href;
    const mod = await import(fileUrl);

    if (typeof mod[targetFunction] !== "function") {
      throw new Error(`Target function '${targetFunction}' not found or not exported in ${sourceFilePath}`);
    }

    let result: unknown;
    if (typeof input === "object" && input !== null) {
      const args = Object.values(input as Record<string, unknown>);
      result = await mod[targetFunction](...args);
    } else {
      result = await mod[targetFunction](input);
    }

    if (process.send) {
      process.send({
        type: "RESULT",
        payload: result,
      });
    }
    process.exit(0);
  } catch (err: unknown) {
    if (process.send) {
      process.send({
        type: "ERROR",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    process.exit(1);
  }
});
