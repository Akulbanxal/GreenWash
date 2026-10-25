import {
  BehaviorContract,
  BehaviorContractSchema,
  ContractCase,
} from "../domain/schemas.js";

export interface SynthesizeContractParams {
  taskDescription: string;
  targetFile: string;
  targetFunction: string;
  contractId?: string;
  sourceCode?: string;
  testCode?: string;
  author?: string;
}

export interface SynthesizeContractResult {
  contract: BehaviorContract;
  method: "heuristic" | "model-assisted";
  caseCount: number;
  warnings?: string[];
}

/**
 * Parses markdown or text descriptions for input/output pairs and test assertions.
 * e.g. "calculateDiscount(1000, 10) => 900", "input: [1000, 10], expected: 900"
 */
function extractHeuristicCases(
  text: string,
  functionName: string
): ContractCase[] {
  const cases: ContractCase[] = [];

  // Pattern 1: expect(func(args)).toBe(expected) or .toEqual(expected)
  const expectRegex = new RegExp(
    `expect\\s*\\(\\s*${functionName}\\s*\\(([^)]+)\\)\\s*\\)\\s*\\.(?:toBe|toEqual)\\s*\\(([^)]+)\\)`,
    "gi"
  );
  let match: RegExpExecArray | null;
  let idx = 1;

  while ((match = expectRegex.exec(text)) !== null) {
    try {
      const rawArgs = match[1].trim();
      const rawExpected = match[2].trim();
      const parsedArgs = JSON.parse(`[${rawArgs}]`);
      const parsedExpected = JSON.parse(rawExpected);

      cases.push({
        id: `case-assert-${idx++}`,
        name: `Assertion case from baseline test`,
        description: `Verified input [${rawArgs}] against expected ${rawExpected}`,
        input: parsedArgs,
        expected: parsedExpected,
      });
    } catch {
      // Fallback: If not valid JSON, treat as raw string if reasonable
    }
  }

  // Pattern 2: func(args) === expected or func(args) => expected
  const arrowRegex = new RegExp(
    `${functionName}\\s*\\(([^)]+)\\)\\s*(?:===|==|=>|->)\\s*([0-9a-zA-Z"'-]+)`,
    "gi"
  );
  while ((match = arrowRegex.exec(text)) !== null) {
    try {
      const rawArgs = match[1].trim();
      const rawExpected = match[2].trim();
      const parsedArgs = JSON.parse(`[${rawArgs}]`);
      const parsedExpected = JSON.parse(rawExpected);

      const exists = cases.some(
        (c) => JSON.stringify(c.input) === JSON.stringify(parsedArgs)
      );
      if (!exists) {
        cases.push({
          id: `case-expr-${idx++}`,
          name: `Expression rule ${idx - 1}`,
          description: `Evaluates ${functionName}(${rawArgs}) to ${rawExpected}`,
          input: parsedArgs,
          expected: parsedExpected,
        });
      }
    } catch {
      // Ignore unparseable expressions
    }
  }

  // Pattern 3: Explicit "input: ..., expected: ..." in prompt/issue
  const tupleRegex =
    /(?:input|args|given):\s*(\[[^\]]+\]|[0-9a-zA-Z"'-]+)[,\s]+(?:expected|output|returns):\s*([0-9a-zA-Z"'-]+)/gi;
  while ((match = tupleRegex.exec(text)) !== null) {
    try {
      let rawArgs = match[1].trim();
      if (!rawArgs.startsWith("[")) {
        rawArgs = `[${rawArgs}]`;
      }
      const rawExpected = match[2].trim();
      const parsedArgs = JSON.parse(rawArgs);
      const parsedExpected = JSON.parse(rawExpected);

      const exists = cases.some(
        (c) => JSON.stringify(c.input) === JSON.stringify(parsedArgs)
      );
      if (!exists) {
        cases.push({
          id: `case-tuple-${idx++}`,
          name: `Explicit input/output invariant`,
          description: `Input ${rawArgs} must produce ${rawExpected}`,
          input: parsedArgs,
          expected: parsedExpected,
        });
      }
    } catch {
      // Ignore unparseable
    }
  }

  return cases;
}

/**
 * BehaviorContractSynthesizer:
 * Synthesizes tamper-proof BehaviorContract schemas from issue descriptions,
 * PR summaries, code comments, and baseline test files.
 */
export class BehaviorContractSynthesizer {
  /**
   * Synthesize a contract deterministically from context.
   */
  synthesize(params: SynthesizeContractParams): SynthesizeContractResult {
    const combinedContext = [
      params.taskDescription,
      params.sourceCode || "",
      params.testCode || "",
    ].join("\n\n");

    const extractedCases = extractHeuristicCases(
      combinedContext,
      params.targetFunction
    );

    const warnings: string[] = [];

    // If no explicit cases could be parsed from text/code, generate a canonical boundary fallback
    if (extractedCases.length === 0) {
      warnings.push(
        `No explicit input/output assertions found for '${params.targetFunction}'. Generated default boundary verification case.`
      );
      extractedCases.push({
        id: "case-boundary-1",
        name: "Canonical execution boundary",
        description: `Automated baseline check for ${params.targetFunction}`,
        input: [0],
        expected: 0,
      });
    }

    const slug = params.targetFunction
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "");
    const contractId =
      params.contractId || `contract-${slug}-v1`;

    const candidateContract: BehaviorContract = {
      id: contractId,
      version: "1.0.0",
      description: `Synthesized invariant contract for ${params.targetFunction}: ${params.taskDescription.slice(
        0,
        140
      )}`,
      targetFile: params.targetFile,
      targetFunction: params.targetFunction,
      cases: extractedCases,
      approvedBy: params.author || "greenwash-synthesizer",
      approvedAt: new Date().toISOString(),
    };

    // Validate using Zod
    const validated = BehaviorContractSchema.parse(candidateContract);

    return {
      contract: validated,
      method: "heuristic",
      caseCount: validated.cases.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
