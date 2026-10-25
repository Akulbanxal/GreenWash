export * from "./domain/schemas.js";
export * from "./domain/status.js";
export * from "./provenance/types.js";
export * from "./gemma/types.js";
export * from "./mastra/types.js";
export * from "./sentry/types.js";
export * from "./contracts/synthesizer.js";
export * from "./graphify/types.js";

export const CORE_VERSION = "0.1.0";
export const CORE_NAME = "Greenwash Core Engine";

export function getCoreInfo() {
  return {
    version: CORE_VERSION,
    name: CORE_NAME,
  };
}
