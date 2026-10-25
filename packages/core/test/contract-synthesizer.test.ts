import { describe, it, expect } from "vitest";
import { BehaviorContractSynthesizer } from "../src/contracts/synthesizer.js";

describe("BehaviorContractSynthesizer Unit Tests", () => {
  const synthesizer = new BehaviorContractSynthesizer();

  it("synthesizes valid BehaviorContract from baseline Vitest expect assertions", () => {
    const testCode = `
      it("calculates 10% coupon", () => {
        expect(calculateDiscount(1000, 10)).toBe(900);
      });
      it("calculates 20% coupon", () => {
        expect(calculateDiscount(500, 20)).toBe(400);
      });
    `;

    const result = synthesizer.synthesize({
      taskDescription: "Fix discount calculation bug when percentage is applied",
      targetFile: "src/discount.ts",
      targetFunction: "calculateDiscount",
      testCode,
    });

    expect(result.contract).toBeDefined();
    expect(result.contract.id).toBe("contract-calculate-discount-v1");
    expect(result.contract.targetFunction).toBe("calculateDiscount");
    expect(result.contract.cases.length).toBe(2);

    // Case 1
    expect(result.contract.cases[0].input).toEqual([1000, 10]);
    expect(result.contract.cases[0].expected).toBe(900);

    // Case 2
    expect(result.contract.cases[1].input).toEqual([500, 20]);
    expect(result.contract.cases[1].expected).toBe(400);
  });

  it("synthesizes contract from natural language prompt with input/output tuples", () => {
    const taskDescription = `
      Implement transferFee calculation:
      Given input: [10000, "WIRE"], returns: 25
      Given input: [500, "ACH"], returns: 0
    `;

    const result = synthesizer.synthesize({
      taskDescription,
      targetFile: "src/banking.ts",
      targetFunction: "transferFee",
    });

    expect(result.contract.cases.length).toBe(2);
    expect(result.contract.cases[0].input).toEqual([10000, "WIRE"]);
    expect(result.contract.cases[0].expected).toBe(25);
    expect(result.contract.cases[1].input).toEqual([500, "ACH"]);
    expect(result.contract.cases[1].expected).toBe(0);
  });

  it("synthesizes fallback boundary case with warning when no input/output tuples exist", () => {
    const result = synthesizer.synthesize({
      taskDescription: "Refactor internal logging for cleanup",
      targetFile: "src/logger.ts",
      targetFunction: "logMessage",
    });

    expect(result.contract.cases.length).toBe(1);
    expect(result.warnings).toBeDefined();
    expect(result.warnings![0]).toContain("No explicit input/output assertions found");
  });
});
