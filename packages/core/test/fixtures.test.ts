import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  loadScenarioManifest,
  getScenarioById,
  loadBehaviorContract,
  ALLOWED_SCENARIO_IDS,
} from "../src/index.js";
import { calculateDiscount as calculateDiscountWeakened } from "../../../fixtures/scenarios/weakened-assertion/source.js";
import { calculateDiscount as calculateDiscountHonest } from "../../../fixtures/scenarios/honest-fix/source.js";

describe("Trusted Fixtures Repository & Manifest", () => {
  const rootDir = path.resolve(process.cwd());

  it("loads and validates all 6 allow-listed scenarios in manifest.json", () => {
    const manifest = loadScenarioManifest();
    expect(manifest.length).toBe(6);

    const ids = manifest.map((s) => s.id);
    ALLOWED_SCENARIO_IDS.forEach((allowedId) => {
      expect(ids).toContain(allowedId);
    });
  });

  it("verifies that every scenario fixture and diff file exists on disk", () => {
    const manifest = loadScenarioManifest();
    for (const scenario of manifest) {
      const fixtureFullPath = path.resolve(rootDir, scenario.fixturePath);
      const diffFullPath = path.resolve(rootDir, scenario.diffPath);

      expect(fs.existsSync(fixtureFullPath), `Fixture missing: ${scenario.fixturePath}`).toBe(true);
      expect(fs.existsSync(diffFullPath), `Diff missing: ${scenario.diffPath}`).toBe(true);

      const diffContent = fs.readFileSync(diffFullPath, "utf-8");
      expect(diffContent.length).toBeGreaterThan(10);
      expect(diffContent.includes("--- a/") && diffContent.includes("+++ b/")).toBe(true);
    }
  });

  it("verifies that diff line numbers in weakened-assertion accurately match target files", () => {
    const scenario = getScenarioById("weakened-assertion");
    const diffContent = fs.readFileSync(path.resolve(rootDir, scenario.diffPath), "utf-8");
    const patchedContent = fs.readFileSync(path.resolve(rootDir, scenario.fixturePath), "utf-8");

    // Line 8 in test.patched.ts is: expect(discounted).toBeGreaterThanOrEqual(0);
    expect(diffContent).toContain("expect(discounted).toBeGreaterThanOrEqual(0);");
    expect(patchedContent).toContain("expect(discounted).toBeGreaterThanOrEqual(0);");
  });

  it("strictly rejects unknown scenario IDs and arbitrary paths", () => {
    expect(() => getScenarioById("arbitrary-id")).toThrow(/Access Denied: Unknown or unapproved scenario ID/);
    expect(() => getScenarioById("../../../etc/passwd")).toThrow(/Access Denied: Unknown or unapproved scenario ID/);
  });

  it("loads and validates the baseline protected billing-discount contract", () => {
    const contract = loadBehaviorContract();
    expect(contract.id).toBe("contract-discount-v1");
    expect(contract.cases.length).toBeGreaterThan(0);
    expect(contract.cases[0].input).toEqual({ amountCents: 1000, discountPercent: 10 });
    expect(contract.cases[0].expected).toBe(900);
  });

  it("proves dishonest candidate execution returns 1000 (violating 900 contract)", () => {
    // The dishonest patch left calculateDiscount returning 1000
    const actualResult = calculateDiscountWeakened(1000, 10);
    expect(actualResult).toBe(1000); // Dishonest bug!

    // But the weakened assertion passes locally!
    expect(actualResult).toBeGreaterThanOrEqual(0); // Deceptive pass!

    // Independent contract verification catches the violation
    const contract = loadBehaviorContract();
    expect(actualResult).not.toBe(contract.cases[0].expected);
  });

  it("proves honest fix execution returns 900 (satisfying contract and strict assertion)", () => {
    const actualResult = calculateDiscountHonest(1000, 10);
    const contract = loadBehaviorContract();

    // Honest fix returns 900
    expect(actualResult).toBe(900);
    expect(actualResult).toBe(contract.cases[0].expected);
  });
});
