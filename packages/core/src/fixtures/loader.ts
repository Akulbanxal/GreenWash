import fs from "node:fs";
import path from "node:path";
import {
  ScenarioDefinition,
  ScenarioDefinitionSchema,
  BehaviorContract,
  BehaviorContractSchema,
} from "../domain/schemas.js";

// Fixed allow-list of scenario IDs
export const ALLOWED_SCENARIO_IDS = [
  "weakened-assertion",
  "deleted-test",
  "skipped-test",
  "excessive-mocking",
  "weakened-ci-gate",
  "honest-fix",
] as const;

export type AllowedScenarioId = (typeof ALLOWED_SCENARIO_IDS)[number];

export function isAllowedScenarioId(id: string): id is AllowedScenarioId {
  return (ALLOWED_SCENARIO_IDS as readonly string[]).includes(id);
}

export function resolveFixturePath(relPath: string): string {
  const candidates = [
    path.resolve(process.cwd(), relPath),
    path.resolve(process.cwd(), "../../", relPath),
    path.resolve(process.cwd(), "../", relPath),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return path.resolve(process.cwd(), relPath);
}

/**
 * Loads and validates the trusted scenarios manifest.
 * Guarantees rejection of unknown scenario IDs and arbitrary paths.
 */
export function loadScenarioManifest(manifestPath?: string): ScenarioDefinition[] {
  const resolvedPath =
    manifestPath ||
    resolveFixturePath("fixtures/manifest.json");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Scenario manifest not found at ${resolvedPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  if (!Array.isArray(raw)) {
    throw new Error("Invalid manifest format: expected array");
  }

  return raw.map((item) => {
    const parsed = ScenarioDefinitionSchema.parse(item);
    if (!isAllowedScenarioId(parsed.id)) {
      throw new Error(`Unapproved scenario ID in manifest: ${parsed.id}`);
    }
    return parsed;
  });
}

/**
 * Safely fetches a scenario by allow-listed ID.
 * Throws on unknown or unapproved IDs (no path traversal).
 */
export function getScenarioById(
  id: string,
  manifestPath?: string
): ScenarioDefinition {
  if (!isAllowedScenarioId(id)) {
    throw new Error(`Access Denied: Unknown or unapproved scenario ID '${id}'`);
  }

  const manifest = loadScenarioManifest(manifestPath);
  const found = manifest.find((s) => s.id === id);
  if (!found) {
    throw new Error(`Scenario '${id}' not found in manifest`);
  }
  return found;
}

/**
 * Safely loads an approved behavior contract.
 */
export function loadBehaviorContract(contractPath?: string): BehaviorContract {
  const resolvedPath =
    contractPath ||
    resolveFixturePath("fixtures/contracts/billing-discount.contract.json");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Behavior contract not found at ${resolvedPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  return BehaviorContractSchema.parse(raw);
}
