import fs from "node:fs";
import path from "node:path";
import { fork } from "node:child_process";
import {
  BehaviorContract,
  BehaviorContractSchema,
  AuditFinding,
  AuditCheck,
  ContractCase,
} from "../domain/schemas.js";
import { fileURLToPath } from "node:url";
import { getScenarioById, isAllowedScenarioId, resolveFixturePath } from "../fixtures/loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ReplayOptions {
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export interface ReplayCaseResult {
  caseId: string;
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  durationMs: number;
  error?: string;
}

export interface ReplayOutcome {
  contractId: string;
  contractVersion: string;
  checks: AuditCheck[];
  findings: AuditFinding[];
  caseResults: ReplayCaseResult[];
}

export class BehaviorReplayRunner {
  private readonly defaultTimeoutMs: number;
  private readonly maxBufferBytes: number;

  constructor(options?: ReplayOptions) {
    this.defaultTimeoutMs = options?.timeoutMs ?? 3000;
    this.maxBufferBytes = options?.maxBufferBytes ?? 1024 * 1024; // 1MB output cap
  }

  /**
   * Replays an allow-listed demo scenario against its protected behavior contract.
   * Enforces trusted fixture boundaries and safe subprocess execution.
   */
  async replayScenario(scenarioId: string, options?: ReplayOptions): Promise<ReplayOutcome> {
    if (!isAllowedScenarioId(scenarioId)) {
      throw new Error(`Access Denied: Replay is only permitted for allow-listed scenario IDs (received: '${scenarioId}')`);
    }

    const scenario = getScenarioById(scenarioId);

    // If scenario has no associated contract (e.g. CI-gate or pure test deletion), emit a not-applicable check
    if (!scenario.contractId) {
      return {
        contractId: "none",
        contractVersion: "0.0.0",
        checks: [
          {
            id: `check-replay-${scenarioId}`,
            label: `Protected Behavior Replay (${scenarioId})`,
            status: "not-run",
            detail: "No protected behavior contract defined for this scenario type.",
          },
        ],
        findings: [],
        caseResults: [],
      };
    }

    // Load immutable approved contract
    const contractPath = resolveFixturePath("fixtures/contracts/billing-discount.contract.json");
    if (!fs.existsSync(contractPath)) {
      throw new Error(`Protected behavior contract not found at: ${contractPath}`);
    }

    const rawContract = JSON.parse(fs.readFileSync(contractPath, "utf-8"));
    const contract = BehaviorContractSchema.parse(rawContract);

    // Resolve target source file based on scenario
    let targetSourcePath: string;
    if (scenarioId === "weakened-assertion") {
      targetSourcePath = resolveFixturePath("fixtures/scenarios/weakened-assertion/source.ts");
    } else if (scenarioId === "honest-fix") {
      targetSourcePath = resolveFixturePath("fixtures/scenarios/honest-fix/source.ts");
    } else {
      targetSourcePath = resolveFixturePath(scenario.fixturePath);
    }

    if (!fs.existsSync(targetSourcePath)) {
      throw new Error(`Target candidate source file not found at: ${targetSourcePath}`);
    }

    return this.executeContractAgainstSource(contract, targetSourcePath, options);
  }

  /**
   * Executes a verified contract against a specified source file inside an isolated subprocess.
   */
  async executeContractAgainstSource(
    contract: BehaviorContract,
    sourceFilePath: string,
    options?: ReplayOptions
  ): Promise<ReplayOutcome> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    // Resolve worker script in dist if running built code or src with ts-node/worker
    let workerScript = path.resolve(__dirname, "worker.js");
    if (!fs.existsSync(workerScript)) {
      workerScript = path.resolve(process.cwd(), "packages/core/dist/replay/worker.js");
    }

    const checks: AuditCheck[] = [];
    const findings: AuditFinding[] = [];
    const caseResults: ReplayCaseResult[] = [];

    for (const testCase of contract.cases) {
      const caseStart = Date.now();
      try {
        const workerResult = await this.runIsolatedWorker(
          workerScript,
          sourceFilePath,
          contract.targetFunction,
          testCase,
          timeoutMs
        );

        const durationMs = Date.now() - caseStart;
        const passed = workerResult.passed;

        caseResults.push({
          caseId: testCase.id,
          name: testCase.name,
          passed,
          expected: testCase.expected,
          actual: workerResult.actual,
          durationMs,
          error: workerResult.error,
        });

        if (passed) {
          checks.push({
            id: `check-contract-${contract.id}-${testCase.id}`,
            label: `Contract Invariant: ${testCase.name}`,
            status: "passed",
            detail: `Returned expected output ${JSON.stringify(testCase.expected)}`,
            durationMs,
          });
        } else {
          checks.push({
            id: `check-contract-${contract.id}-${testCase.id}`,
            label: `Contract Invariant: ${testCase.name}`,
            status: "failed",
            detail: workerResult.error
              ? `Execution error: ${workerResult.error}`
              : `Expected ${JSON.stringify(testCase.expected)}, but candidate returned ${JSON.stringify(workerResult.actual)}`,
            durationMs,
          });

          const ruleId = workerResult.error ? "CONTRACT-RUNNER-ERROR" : "CONTRACT-VIOLATION";
          const title = workerResult.error ? "Contract Replay Execution Error" : "Protected Behavior Invariant Violated";

          findings.push({
            id: `fnd-contract-${contract.id}-${testCase.id}`,
            ruleId,
            title,
            summary: workerResult.error
              ? `Execution error in '${contract.targetFunction}': ${workerResult.error}`
              : `Function '${contract.targetFunction}' in ${contract.targetFile} returned ${JSON.stringify(workerResult.actual)} instead of approved ${JSON.stringify(testCase.expected)}.`,
            severity: "critical",
            source: "contract-replay",
            evidence: [
              {
                filePath: contract.targetFile,
                title: workerResult.error ? "Execution Error Detail" : `Counterexample Replay: ${testCase.name}`,
                detail: workerResult.error
                  ? workerResult.error
                  : `Input: ${JSON.stringify(testCase.input)} | Expected: ${JSON.stringify(testCase.expected)} | Actual: ${JSON.stringify(workerResult.actual)}`,
              },
            ],
            expected: testCase.expected,
            actual: workerResult.actual,
            reproductionCommand: `npm run greenwash -- demo --scenario weakened-assertion`,
            humanAction: workerResult.error
              ? "Fix runtime execution crash or missing function in candidate implementation."
              : "Candidate patch breaks verified contract behavior. Fix core domain logic rather than weakening tests.",
            limitations: [
              "Independent replay tests approved contracts; it does not replace full regression suites.",
            ],
          });
        }
      } catch (err: unknown) {
        const durationMs = Date.now() - caseStart;
        const errorMessage = err instanceof Error ? err.message : String(err);

        caseResults.push({
          caseId: testCase.id,
          name: testCase.name,
          passed: false,
          expected: testCase.expected,
          actual: null,
          durationMs,
          error: errorMessage,
        });

        // A timed-out or missing replay is NOT a PASS!
        checks.push({
          id: `check-contract-${contract.id}-${testCase.id}`,
          label: `Contract Invariant: ${testCase.name}`,
          status: "failed",
          detail: `Runner failure: ${errorMessage}`,
          durationMs,
        });

        findings.push({
          id: `fnd-contract-error-${contract.id}-${testCase.id}`,
          ruleId: "CONTRACT-RUNNER-ERROR",
          title: "Contract Replay Execution Error",
          summary: `Replay failed to complete: ${errorMessage}`,
          severity: "critical",
          source: "contract-replay",
          evidence: [
            {
              filePath: contract.targetFile,
              title: "Subprocess Runner Failure",
              detail: errorMessage,
            },
          ],
          humanAction: "Inspect candidate source for infinite loops, fatal syntax errors, or execution crashes.",
          limitations: [],
        });
      }
    }

    return {
      contractId: contract.id,
      contractVersion: contract.version,
      checks,
      findings,
      caseResults,
    };
  }

  /**
   * Spawns worker in child process with timeout protection and output bounding.
   */
  private runIsolatedWorker(
    workerScript: string,
    sourceFilePath: string,
    targetFunction: string,
    testCase: ContractCase,
    timeoutMs: number
  ): Promise<{ passed: boolean; actual: unknown; error?: string }> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      // Launch worker child process
      const child = fork(workerScript, [], {
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: {
          NODE_ENV: "test",
        },
      });

      let stdoutBuffer = "";
      let stderrBuffer = "";

      child.stdout?.on("data", (chunk: Buffer) => {
        if (stdoutBuffer.length < this.maxBufferBytes) {
          stdoutBuffer += chunk.toString("utf-8");
        }
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderrBuffer.length < this.maxBufferBytes) {
          stderrBuffer += chunk.toString("utf-8");
        }
      });

      // Timeout boundary
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill("SIGKILL");
          reject(new Error(`Subprocess timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Listen for message from worker
      child.on("message", (msg: { type: string; payload?: unknown; error?: string }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);

        if (msg.type === "RESULT") {
          const actual = msg.payload;
          const passed = JSON.stringify(actual) === JSON.stringify(testCase.expected);
          resolve({ passed, actual });
        } else if (msg.type === "ERROR") {
          resolve({ passed: false, actual: null, error: msg.error });
        }
      });

      child.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(err);
        }
      });

      child.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (code !== 0) {
            reject(new Error(`Subprocess exited abnormally with code ${code}: ${stderrBuffer || stdoutBuffer}`));
          } else {
            reject(new Error("Subprocess exited without returning result"));
          }
        }
      });

      // Send payload to worker
      child.send({
        sourceFilePath,
        targetFunction,
        input: testCase.input,
      });
    });
  }
}
