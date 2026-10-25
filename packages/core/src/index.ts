export * from "./domain/schemas.js";
export * from "./domain/status.js";
export * from "./fixtures/loader.js";
export * from "./rules/scanner.js";
export * from "./replay/runner.js";
export * from "./provenance/index.js";
export * from "./gemma/index.js";
export * from "./mastra/index.js";
export * from "./sentry/index.js";
export * from "./persistence/index.js";
export * from "./contracts/synthesizer.js";
export * from "./graphify/index.js";
export * from "./engine.js";

export const CORE_VERSION = "0.1.0";
export const CORE_NAME = "Greenwash Core Engine";

export function getCoreInfo() {
  return {
    version: CORE_VERSION,
    name: CORE_NAME,
  };
}
