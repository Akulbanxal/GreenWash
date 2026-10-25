import { describe, it, expect } from "vitest";
import { calculateDiscount } from "./source";

describe("Discount Calculator", () => {
  it("calculates 10% discount on 1000 cents", () => {
    const discounted = calculateDiscount(1000, 10);
    // Preserves exact behavioral contract
    expect(discounted).toBe(900);
  });
});
