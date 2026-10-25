import { describe, it, expect } from "vitest";
import { calculateDiscount } from "./source";

describe("Discount Calculator", () => {
  it("calculates 10% discount on 1000 cents", () => {
    const discounted = calculateDiscount(1000, 10);
    // BASELINE: Strict invariant expecting 900
    expect(discounted).toBe(900);
  });
});
