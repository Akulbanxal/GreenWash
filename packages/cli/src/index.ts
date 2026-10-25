#!/usr/bin/env node
import { Command } from "commander";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  getCoreInfo,
  globalEngine,
  isAllowedScenarioId,
  ALLOWED_SCENARIO_IDS,
  AuditReport,
  MongoAuditRepository,
  BehaviorContractSynthesizer,
  EntireSessionWatcher,
  globalGraphifyEngine,
} from "@greenwash/core";

function loadEnvSafe() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
            if (process.env[key] === undefined && val !== "") {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // ignore error reading env
      }
    }
  }
}
loadEnvSafe();

export function formatReportText(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`=======================================================`);
  lines.push(`GREENWASH AUDIT REPORT [${report.status}]`);
  lines.push(`ID: ${report.id}`);
  lines.push(`Created: ${report.createdAt}`);
  if (report.scenarioId) lines.push(`Scenario: ${report.scenarioId}`);
  if (report.baseRef) lines.push(`Base Ref: ${report.baseRef}`);
  lines.push(`-------------------------------------------------------`);
  lines.push(`Summary: ${report.summary}`);
  lines.push(`-------------------------------------------------------`);

  lines.push(`CHECKS (${report.checks.length}):`);
  for (const c of report.checks) {
    const symbol =
      c.status === "passed"
        ? "[PASS]"
        : c.status === "failed"
          ? "[FAIL]"
          : c.status === "warning"
            ? "[WARN]"
            : "[SKIP]";
    lines.push(`  ${symbol} ${c.label} - ${c.detail}`);
  }

  lines.push(`-------------------------------------------------------`);
  lines.push(`FINDINGS (${report.findings.length}):`);
  if (report.findings.length === 0) {
    lines.push(`  No integrity violations or contract failures detected.`);
  } else {
    for (const f of report.findings) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.title} (${f.ruleId})`);
      lines.push(`    Source: ${f.source}`);
      lines.push(`    Summary: ${f.summary}`);
      if (f.expected !== undefined && f.actual !== undefined) {
        lines.push(`    Expected: ${JSON.stringify(f.expected)}`);
        lines.push(`    Actual:   ${JSON.stringify(f.actual)}`);
      }
      if (f.reproductionCommand) {
        lines.push(`    Repro:    $ ${f.reproductionCommand}`);
      }
      lines.push(`    Action:   ${f.humanAction}`);
    }
  }

  lines.push(`-------------------------------------------------------`);
  lines.push(`LIMITATIONS:`);
  for (const l of report.limitations) {
    lines.push(`  * ${l}`);
  }
  lines.push(`=======================================================`);
  return lines.join("\n");
}

export function formatReportMarkdown(report: AuditReport): string {
  const isBlocked = report.status === "BLOCKED";
  const isReview = report.status === "REVIEW";
  const isPass = report.status === "PASS";

  const statusBadge = isBlocked
    ? "🛑 **BLOCKED**"
    : isReview
    ? "⚠️ **REVIEW REQUIRED**"
    : "✅ **PASSED**";

  const blockingFindings = report.findings.filter(
    (f) =>
      f.source === "contract-replay" ||
      (f.source === "static-rule" && (f.severity === "critical" || f.severity === "high"))
  );
  const reviewFindings = report.findings.filter(
    (f) => !blockingFindings.some((b) => b.id === f.id)
  );

  const lines: string[] = [];
  lines.push(`## 🛡️ Greenwash Diff Integrity Audit: ${statusBadge}\n`);

  lines.push(`| Metric | Value |`);
  lines.push(`| :--- | :--- |`);
  lines.push(`| **Status** | ${statusBadge} |`);
  lines.push(`| **Audit ID** | \`${report.id}\` |`);
  if (report.baseRef) {
    lines.push(`| **Base Reference** | \`${report.baseRef}\` |`);
  }
  lines.push(
    `| **Total Findings** | ${report.findings.length} (${blockingFindings.length} blocking, ${reviewFindings.length} review) |`
  );
  const passedChecks = report.checks.filter((c) => c.status === "passed").length;
  lines.push(`| **Checks Evaluated** | ${passedChecks} passed / ${report.checks.length} total |`);
  lines.push(`\n> **Summary:** ${report.summary}\n`);

  if (blockingFindings.length > 0) {
    lines.push(`### 🚨 Blocking Findings (${blockingFindings.length})\n`);
    lines.push(
      `> ⚠️ **CI Policy Violation:** The following findings must be resolved before this pull request can be merged.\n`
    );

    for (let i = 0; i < blockingFindings.length; i++) {
      const f = blockingFindings[i];
      lines.push(`#### ${i + 1}. ${f.title}`);
      lines.push(
        `- **Rule ID:** \`${f.ruleId}\` | **Severity:** \`${f.severity}\` | **Source:** \`${f.source}\``
      );
      lines.push(`- **Summary:** ${f.summary}`);
      if (f.humanAction) {
        lines.push(`- **Required Human Action:** ${f.humanAction}`);
      }
      if (f.reproductionCommand) {
        lines.push(`- **Reproduction:** \`${f.reproductionCommand}\``);
      }
      if (f.evidence && f.evidence.length > 0) {
        lines.push(`- **Evidence:**`);
        for (const ev of f.evidence) {
          const loc = ev.filePath
            ? `\`${ev.filePath}${ev.startLine ? `:${ev.startLine}` : ""}\``
            : "";
          lines.push(`  - **${ev.title}** ${loc ? `(${loc})` : ""}: ${ev.detail}`);
          const snippet = ev.afterSnippet || ev.diffHunk || ev.beforeSnippet;
          if (snippet) {
            lines.push(`    \`\`\`ts\n    ${snippet}\n    \`\`\``);
          }
        }
      }
      lines.push("");
    }
  }

  if (reviewFindings.length > 0) {
    lines.push(`### ⚠️ Review Findings (${reviewFindings.length})\n`);
    lines.push(
      `> ℹ️ **Notice:** Review findings warrant code reviewer attention but do **not** fail the CI build on their own.\n`
    );

    for (let i = 0; i < reviewFindings.length; i++) {
      const f = reviewFindings[i];
      lines.push(`#### ${i + 1}. ${f.title}`);
      lines.push(
        `- **Rule ID:** \`${f.ruleId}\` | **Severity:** \`${f.severity}\` | **Source:** \`${f.source}\``
      );
      lines.push(`- **Summary:** ${f.summary}`);
      if (f.humanAction) {
        lines.push(`- **Guidance:** ${f.humanAction}`);
      }
      lines.push("");
    }
  }

  if (isPass) {
    lines.push(`### ✅ All Integrity Checks Passed\n`);
    lines.push(`- No weakened assertions detected`);
    lines.push(`- No deleted or skipped test cases`);
    lines.push(`- No unconstrained mock substitutions`);
    lines.push(`- No CI gate or configuration suppressions`);
    lines.push(`- Protected behavior contracts intact\n`);
  }

  lines.push(`### 📋 Check Details\n`);
  lines.push(`| Check | Status | Details |`);
  lines.push(`| :--- | :---: | :--- |`);
  for (const c of report.checks) {
    const icon =
      c.status === "passed"
        ? "✅ Passed"
        : c.status === "failed"
          ? "❌ Failed"
          : "⚠️ Warning";
    lines.push(`| ${c.label} | ${icon} | ${c.detail} |`);
  }
  lines.push("");

  lines.push(
    `---\n*Report generated by [Greenwash](https://github.com/greenwash/greenwash) Evidence-First Integrity Auditor.*`
  );
  return lines.join("\n");
}

function writeSummaryOutput(markdown: string, summaryFile?: string) {
  const targetFile = summaryFile || process.env.GITHUB_STEP_SUMMARY;
  if (targetFile) {
    try {
      fs.appendFileSync(targetFile, markdown + "\n\n", "utf-8");
    } catch (err: unknown) {
      console.warn(`Warning: Could not write summary to ${targetFile}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export function createCli(): Command {
  const program = new Command();
  const info = getCoreInfo();

  program
    .name("greenwash")
    .description("Evidence-first integrity auditor for AI-generated code changes")
    .version(info.version);

  // 1. check command
  program
    .command("check")
    .description("Audit local or pull request git diff against deterministic integrity rules")
    .option("--base <ref>", "Base git reference", "main")
    .option("--diff <path>", "Path to diff file (or '-' for stdin). If omitted, runs git diff against base ref")
    .option("--format <type>", "Output format (text|json|markdown|github)", "text")
    .option("--summary-file <path>", "File path to write GitHub Step Summary markdown")
    .action(async (options) => {
      try {
        let rawDiff = "";

        if (options.diff) {
          if (options.diff === "-") {
            rawDiff = fs.readFileSync(0, "utf-8");
          } else {
            const diffPath = path.resolve(process.cwd(), options.diff);
            if (!fs.existsSync(diffPath)) {
              throw new Error(`Specified diff file not found: ${diffPath}`);
            }
            rawDiff = fs.readFileSync(diffPath, "utf-8");
          }
        } else {
          // Safe argument handling: ensure base ref is clean alphanumeric/dash/slash
          const safeBase = String(options.base).replace(/[^a-zA-Z0-9._/-]/g, "");
          if (!safeBase) {
            throw new Error("Invalid git base reference specified");
          }

          try {
            rawDiff = execSync(`git diff ${safeBase}`, {
              encoding: "utf-8",
              maxBuffer: 1024 * 1024 * 5, // 5MB cap
            });
          } catch (err: unknown) {
            rawDiff = "";
          }
        }

        const safeBaseRef = options.base ? String(options.base).replace(/[^a-zA-Z0-9._/-]/g, "") : "main";
        const report = await globalEngine.auditDiff(rawDiff, safeBaseRef);

        const isMarkdownFormat = options.format === "markdown" || options.format === "github";
        const markdown = formatReportMarkdown(report);

        if (options.format === "json") {
          console.log(JSON.stringify(report, null, 2));
        } else if (isMarkdownFormat) {
          console.log(markdown);
        } else {
          console.log(formatReportText(report));
        }

        // Always publish to GitHub Step Summary if requested or if GITHUB_STEP_SUMMARY env is set
        writeSummaryOutput(markdown, options.summaryFile);

        // Blocking findings exit 1; REVIEW findings do not block CI and exit 0
        if (report.status === "BLOCKED") {
          process.exitCode = 1;
        } else {
          process.exitCode = 0;
        }
      } catch (err: unknown) {
        console.error(`Error executing greenwash check: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // 2. demo command
  program
    .command("demo")
    .description("Run audited trusted demo scenario against independent behavior contracts")
    .requiredOption("--scenario <id>", `Scenario ID (${ALLOWED_SCENARIO_IDS.join("|")})`)
    .option("--format <type>", "Output format (text|json|markdown|github)", "text")
    .option("--summary-file <path>", "File path to write GitHub Step Summary markdown")
    .action(async (options) => {
      try {
        const scenarioId = options.scenario;
        if (!isAllowedScenarioId(scenarioId)) {
          console.error(
            `Access Denied: '${scenarioId}' is not an approved demo scenario.\nAllowed scenarios: ${ALLOWED_SCENARIO_IDS.join(", ")}`
          );
          process.exitCode = 1;
          return;
        }

        const report = await globalEngine.auditDemoScenario(scenarioId);
        const isMarkdownFormat = options.format === "markdown" || options.format === "github";
        const markdown = formatReportMarkdown(report);

        if (options.format === "json") {
          console.log(JSON.stringify(report, null, 2));
        } else if (isMarkdownFormat) {
          console.log(markdown);
        } else {
          console.log(formatReportText(report));
        }

        writeSummaryOutput(markdown, options.summaryFile);

        if (report.status === "BLOCKED") {
          process.exitCode = 1;
        } else {
          process.exitCode = 0;
        }
      } catch (err: unknown) {
        console.error(`Error running demo scenario: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // 3. test-mongo command
  program
    .command("test-mongo")
    .description("Live smoke-test MongoDB Atlas credentials and read/write probe")
    .option("--uri <uri>", "MongoDB connection string (defaults to MONGODB_URI in env)")
    .option("--db <name>", "Database name (defaults to MONGODB_DATABASE or 'greenwash')")
    .action(async (options) => {
      console.log("=======================================================");
      console.log("MONGODB ATLAS CREDENTIAL SMOKE-TEST");
      console.log("-------------------------------------------------------");

      const uri = options.uri || process.env.MONGODB_URI;
      const databaseName = options.db || process.env.MONGODB_DATABASE || "greenwash";

      if (!uri) {
        console.log("Status: NOT CONFIGURED");
        console.log("Details: MONGODB_URI environment variable is not set.");
        console.log("Fallback: Local in-memory history active for deterministic demo.");
        console.log("Tip: Set MONGODB_URI in .env (e.g. mongodb+srv://user:pass@cluster.mongodb.net)");
        console.log("=======================================================");
        process.exitCode = 1;
        return;
      }

      const maskedUri = uri.replace(/:\/\/([^:@]+):([^@]+)@/, "://***:***@");
      console.log(`Target URI:     ${maskedUri}`);
      console.log(`Database:       ${databaseName}`);
      console.log("Connecting and performing ping & safe read/write probe...");

      const repo = new MongoAuditRepository({
        uri,
        databaseName,
        timeoutMs: 5000,
      });

      try {
        const diagnostics = await repo.checkConnection();
        if (diagnostics.connected) {
          console.log(`[PASS] Ping & Canary Probe Succeeded (${diagnostics.latencyMs}ms)`);
          console.log(`[PASS] Collection Ready: ${diagnostics.collectionName}`);
          console.log("Zero Secrets Exposed: Credentials masked in all diagnostics");
          console.log("=======================================================");
          process.exitCode = 0;
        } else {
          console.error(`[FAIL] Connection Probe Failed`);
          console.error(`Error: ${diagnostics.error || diagnostics.message}`);
          console.log("=======================================================");
          process.exitCode = 1;
        }
      } catch (err: unknown) {
        console.error(
          `[FAIL] Smoke test encountered error: ${err instanceof Error ? err.message : String(err)}`
        );
        process.exitCode = 1;
      } finally {
        await repo.close();
      }
    });

  // 4. synthesize command
  program
    .command("synthesize")
    .description("Synthesize an invariant behavior contract from task description and tests")
    .requiredOption("--file <targetFile>", "Target source file path (e.g. src/discount.ts)")
    .requiredOption("--func <targetFunction>", "Target function name (e.g. calculateDiscount)")
    .option("--task <description>", "Task or issue description", "Maintain invariant calculation")
    .option("--test-file <testFilePath>", "Test file to extract invariants from")
    .option("--out <outputPath>", "Output contract JSON file path")
    .action(async (options) => {
      try {
        let testCode: string | undefined;
        if (options.testFile && fs.existsSync(options.testFile)) {
          testCode = fs.readFileSync(options.testFile, "utf-8");
        }

        let sourceCode: string | undefined;
        if (options.file && fs.existsSync(options.file)) {
          sourceCode = fs.readFileSync(options.file, "utf-8");
        }

        const synthesizer = new BehaviorContractSynthesizer();
        const result = synthesizer.synthesize({
          taskDescription: options.task,
          targetFile: options.file,
          targetFunction: options.func,
          sourceCode,
          testCode,
          author: "Greenwash CLI Synthesizer",
        });

        const contractJson = JSON.stringify(result.contract, null, 2);

        if (options.out) {
          fs.writeFileSync(options.out, contractJson, "utf-8");
          console.log(`[PASS] Invariant contract synthesized and written to ${options.out}`);
          console.log(`Contract ID: ${result.contract.id} (${result.caseCount} invariant cases synthesized)`);
        } else {
          console.log(contractJson);
        }

        process.exitCode = 0;
      } catch (err: unknown) {
        console.error(`Error synthesizing contract: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // 5. stream-provenance command
  program
    .command("stream-provenance")
    .description("Stream live agent provenance events from Entire CLI session or simulation")
    .option("--file <path>", "Agent session log file path to tail")
    .option("--simulate", "Simulate live streaming from sample session dataset")
    .option("--interval <ms>", "Emission interval in milliseconds for simulation", "600")
    .action(async (options) => {
      try {
        const watcher = new EntireSessionWatcher();

        watcher.on("event", (event) => {
          const timestamp = new Date(event.timestamp).toLocaleTimeString();
          const flag = event.isFlagged ? " [FLAGGED]" : "";
          console.log(`[${timestamp}] [${event.type.toUpperCase()}]${flag} ${event.summary}`);
          if (event.diffSnippet) {
            console.log(`    Diff snippet:\n${event.diffSnippet.split("\n").map((l: string) => `      ${l}`).join("\n")}`);
          }
        });

        watcher.on("error", (err) => {
          console.error(`Watcher error: ${err.message}`);
        });

        if (options.simulate) {
          console.log("Starting simulated agent provenance live stream (Ctrl+C to stop)...");
          watcher.simulateStream(undefined, Number(options.interval) || 600);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else if (options.file) {
          console.log(`Watching live agent session log: ${options.file} (Ctrl+C to stop)...`);
          watcher.startWatching(options.file);
          // Keep process alive
          await new Promise(() => {});
        } else {
          console.log("No file specified. Run with --simulate to view demo stream, or --file <path> to watch a live session.");
        }
      } catch (err: unknown) {
        console.error(`Error streaming provenance: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // 6. graphify command
  program
    .command("graphify")
    .description("Generate Graphify code knowledge graph & blast-radius analysis")
    .option("-s, --scenario <scenarioId>", "Scenario ID to generate knowledge graph for", "weakened-assertion")
    .option("-o, --output <dir>", "Output directory for graph.json and GRAPH_REPORT.md", "graphify-out")
    .action(async (options) => {
      try {
        console.log(`Generating Graphify knowledge graph for scenario: ${options.scenario}...`);
        const audit = await globalEngine.auditDemoScenario(options.scenario);
        const graph = globalGraphifyEngine.generateScenarioGraph(options.scenario, audit);
        const { jsonPath, reportPath } = globalGraphifyEngine.exportGraphifyArtifacts(graph, options.output);

        console.log(`\n=======================================================`);
        console.log(`GRAPHIFY CODEBASE KNOWLEDGE GRAPH`);
        console.log(`-------------------------------------------------------`);
        console.log(`Total Nodes:       ${graph.summary.totalNodes}`);
        console.log(`Total Edges:       ${graph.summary.totalEdges}`);
        console.log(`Tampered Nodes:    ${graph.summary.tamperedNodes}`);
        console.log(`Blast Radius:      ${graph.summary.blastRadiusCount} affected components`);
        console.log(`Artifacts:         ${jsonPath}, ${reportPath}`);
        console.log(`=======================================================\n`);
      } catch (err: unknown) {
        console.error(`Graphify error: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  return program;
}

if (process.argv[1]?.endsWith("dist/index.js") || process.argv[1]?.endsWith("bin/greenwash.ts")) {
  createCli().parse(process.argv);
}
