import { describe, it, expect } from "vitest";
import { getCoreInfo, AuditStatusSchema } from "../src/index.js";

describe("@greenwash/core baseline", () => {
  it("returns validated core version info", () => {
    const info = getCoreInfo();
    expect(info.name).toBe("Greenwash Core Engine");
    expect(info.version).toBe("0.1.0");
  });

  it("validates audit status enum correctly", () => {
    expect(AuditStatusSchema.safeParse("PASS").success).toBe(true);
    expect(AuditStatusSchema.safeParse("REVIEW").success).toBe(true);
    expect(AuditStatusSchema.safeParse("BLOCKED").success).toBe(true);
    expect(AuditStatusSchema.safeParse("INVALID").success).toBe(false);
  });
});
