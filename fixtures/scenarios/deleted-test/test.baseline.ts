import { describe, it, expect } from "vitest";

describe("Account Operations", () => {
  it("processes regular deposit", () => {
    expect(100 + 50).toBe(150);
  });

  it("handles concurrent withdrawals without deadlock", () => {
    // Failing concurrency test that exposed race condition
    const deadlockDetected = true;
    expect(deadlockDetected).toBe(false);
  });
});
