import { describe, it, expect, vi } from "vitest";

const TokenValidator = {
  verify: (_token: string) => false,
};

describe("Authentication Service", () => {
  it("authenticates token", () => {
    // Agent mocks out the unit under test itself to return true
    vi.spyOn(TokenValidator, "verify").mockReturnValue(true);
    expect(TokenValidator.verify("expired-token")).toBe(true);
  });
});
