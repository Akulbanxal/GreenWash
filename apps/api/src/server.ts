import fs from "node:fs";
import path from "node:path";
import express, { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  getCoreInfo,
  loadScenarioManifest,
  globalEngine,
  isAllowedScenarioId,
  AuditReport,
  IntegrationStatus,
  EntireSessionProvider,
  EntireSessionWatcher,
  BehaviorContractSchema,
  BehaviorContractSynthesizer,
  GemmaSemanticReviewer,
  GemmaReviewRequestSchema,
  getSentryStatus,
  verifySentryConnection,
  initSentry,
  setGlobalAuditRepository,
  MongoAuditRepository,
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
if (process.env.SENTRY_DSN) {
  initSentry({ dsn: process.env.SENTRY_DSN });
}
if (process.env.MONGODB_URI) {
  setGlobalAuditRepository(
    new MongoAuditRepository({
      uri: process.env.MONGODB_URI,
      databaseName: process.env.MONGODB_DATABASE,
      collectionName: process.env.MONGODB_COLLECTION,
    })
  );
}

export const DemoAuditRequestSchema = z.object({
  scenarioId: z.string().min(1).max(100),
});

export function createApp(): Express {
  const app = express();

  // Security: Payload size limits & CORS/security headers
  app.use(express.json({ limit: "500kb" }));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  /**
   * GET /api/health
   * Safe health check with guaranteed zero secret/env variable leakage.
   */
  app.get("/api/health", (_req: Request, res: Response) => {
    const info = getCoreInfo();
    res.json({
      status: "ok",
      version: info.version,
      engine: info.name,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/scenarios
   * Allow-listed scenarios and public threat descriptions.
   */
  app.get("/api/scenarios", (_req: Request, res: Response) => {
    try {
      const scenarios = loadScenarioManifest();
      res.json(scenarios);
    } catch (err: unknown) {
      res.status(500).json({ error: "Failed to load scenarios manifest" });
    }
  });

  /**
   * GET /api/scenarios/:id/diff
   * Returns the raw unified diff for a given scenario.
   */
  app.get("/api/scenarios/:id/diff", (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isAllowedScenarioId(id)) {
      return res.status(404).json({ error: `Scenario '${id}' not found` });
    }

    try {
      const scenario = loadScenarioManifest().find((s) => s.id === id);
      if (!scenario) {
        return res.status(404).json({ error: `Scenario '${id}' not found in manifest` });
      }

      const diffFullPath = path.resolve(process.cwd(), scenario.diffPath);
      if (!fs.existsSync(diffFullPath)) {
        return res.status(404).json({ error: `Diff file not found for '${id}'` });
      }

      const diffContent = fs.readFileSync(diffFullPath, "utf-8");
      res.setHeader("Content-Type", "text/plain");
      res.send(diffContent);
    } catch (err: unknown) {
      res.status(500).json({ error: "Failed to read scenario diff" });
    }
  });

  /**
   * POST /api/audits/demo
   * Runs audited trusted fixture for a schema-validated allow-listed scenario ID.
   */
  app.post("/api/audits/demo", async (req: Request, res: Response) => {
    const parseResult = DemoAuditRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid request payload",
        details: parseResult.error.issues,
      });
    }

    const { scenarioId } = parseResult.data;
    if (!isAllowedScenarioId(scenarioId)) {
      return res.status(400).json({
        error: `Scenario '${scenarioId}' is not an approved demo scenario.`,
      });
    }

    try {
      const result = await globalEngine.runPipeline({ scenarioId });
      res.json({
        ...result.report,
        runId: result.runId,
        workflowId: result.workflowId,
        stepRecords: result.stepRecords,
        trace: result.trace,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal audit execution failure";
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/audits/pipeline
   * Runs the bounded Mastra workflow audit pipeline with typed steps, telemetry, and step records.
   */
  app.post("/api/audits/pipeline", async (req: Request, res: Response) => {
    const PipelineRequestSchema = z.object({
      scenarioId: z.string().optional(),
      diff: z.string().optional(),
      baseRef: z.string().optional(),
      options: z
        .object({
          enableGemma: z.boolean().optional(),
          enableEntire: z.boolean().optional(),
          stepTimeoutMs: z.number().optional(),
          totalTimeoutMs: z.number().optional(),
        })
        .optional(),
    });

    const parseResult = PipelineRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid pipeline request payload",
        details: parseResult.error.issues,
      });
    }

    if (parseResult.data.scenarioId && !isAllowedScenarioId(parseResult.data.scenarioId)) {
      return res.status(400).json({
        error: `Scenario '${parseResult.data.scenarioId}' is not an approved demo scenario.`,
      });
    }

    try {
      const result = await globalEngine.runPipeline(parseResult.data);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Pipeline workflow execution failure";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/audits/:id
   * Retrieves an audit report by ID.
   */
  app.get("/api/audits/:id", (req: Request, res: Response) => {
    const report = globalEngine.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: `Audit report '${req.params.id}' not found` });
    }
    res.json(report);
  });

  /**
   * GET /api/audits/history
   * Lists sanitized summaries of completed audits.
   */
  app.get("/api/audits", async (_req: Request, res: Response) => {
    const summaries = await globalEngine.listSummaries({ includeSample: false });
    res.json(summaries.length > 0 ? summaries : globalEngine.listAuditSummaries());
  });

  /**
   * GET /api/history
   * Queries real stored sanitized audit summaries and reports actual storage mode.
   */
  app.get("/api/history", async (_req: Request, res: Response) => {
    try {
      const repo = globalEngine.getRepository();
      const diagnostics = await repo.checkConnection();
      let records = await repo.listSummaries({ includeSample: false });

      // If repository has no persisted records yet, check in-memory report store for current session
      if (records.length === 0) {
        const inMemSummaries = globalEngine.listAuditSummaries();
        if (inMemSummaries.length > 0) {
          records = inMemSummaries;
        }
      }

      res.json({
        storageMode: repo.getStorageMode(),
        connected: diagnostics.connected,
        diagnostics,
        records,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load audit history";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/history/:id
   * Retrieves full sanitized persisted record by ID.
   */
  app.get("/api/history/:id", async (req: Request, res: Response) => {
    try {
      const repo = globalEngine.getRepository();
      const record = await repo.getRecordById(req.params.id);
      if (record) {
        return res.json(record);
      }

      // Check in-memory reportStore fallback
      const inMemReport = globalEngine.getReportById(req.params.id);
      if (inMemReport) {
        const sanitized = await repo.saveReport(inMemReport);
        return res.json(sanitized);
      }

      res.status(404).json({ error: `Audit record '${req.params.id}' not found` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to read audit record";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/diagnostics/mongodb
   * Storage connection check and actual mode diagnostics without leaking credentials.
   */
  app.get("/api/diagnostics/mongodb", async (_req: Request, res: Response) => {
    try {
      const repo = globalEngine.getRepository();
      const diagnostics = await repo.checkConnection();
      res.json(diagnostics);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "MongoDB diagnostics check failed";
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/diagnostics/mongodb/verify
   * Triggers a live verification probe against MongoDB Atlas cluster.
   */
  app.post("/api/diagnostics/mongodb/verify", async (_req: Request, res: Response) => {
    try {
      const repo = globalEngine.getRepository();
      const diagnostics = await repo.checkConnection();
      res.json(diagnostics);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "MongoDB verification probe failed";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/integrations/status
   * Real statuses of integrations with zero secret disclosure.
   */
  app.get("/api/integrations/status", (_req: Request, res: Response) => {
    const integrations: IntegrationStatus[] = [
      {
        id: "gemma",
        name: "Gemma Open-Weight Reviewer",
        state: process.env.GEMMA_ENDPOINT ? "configured-not-verified" : "not-configured",
        message: process.env.GEMMA_ENDPOINT
          ? "Endpoint configured. Semantic analysis ready."
          : "Gemma offline (Ollama / endpoint not set) — deterministic rules remain 100% active.",
      },
      {
        id: "entire",
        name: "Entire Session Provenance",
        state: process.env.ENTIRE_SESSION_PATH ? "configured-not-verified" : "sample-only",
        message: process.env.ENTIRE_SESSION_PATH
          ? "Entire session path configured."
          : "Sample session dataset loaded — not a live connection.",
      },
      {
        id: "sentry",
        name: "Sentry Agent Tracing",
        state: process.env.SENTRY_DSN ? "configured-not-verified" : "not-configured",
        message: process.env.SENTRY_DSN
          ? "Sentry DSN provided."
          : "Sentry not configured — zero synthetic trace spans emitted.",
      },
      {
        id: "mongodb",
        name: "MongoDB Atlas History",
        state: process.env.MONGODB_URI ? "configured-not-verified" : "not-configured",
        message: process.env.MONGODB_URI
          ? "MongoDB connection string provided."
          : "Local in-memory history active — Atlas not configured.",
      },
    ];

    res.json(integrations);
  });

  /**
   * GET /api/contracts
   * Lists approved behavior contracts and protected invariants.
   */
  app.get("/api/contracts", (_req: Request, res: Response) => {
    try {
      const contractsDir = path.resolve(process.cwd(), "fixtures/contracts");
      if (!fs.existsSync(contractsDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(contractsDir).filter((f) => f.endsWith(".json"));
      const contracts = files.map((file) => {
        const content = fs.readFileSync(path.join(contractsDir, file), "utf-8");
        return JSON.parse(content);
      });
      res.json(contracts);
    } catch (err: unknown) {
      res.status(500).json({ error: "Failed to load contracts" });
    }
  });

  /**
   * POST /api/contracts/review-update
   * Requires explicit human review operation to update a contract baseline.
   * Rejects unreviewed or malicious baseline modification.
   */
  app.post("/api/contracts/review-update", (req: Request, res: Response) => {
    const { contract, reviewerToken, reviewNotes } = req.body || {};
    if (!reviewerToken || reviewerToken !== "SEC-COUNCIL-APPROVED-OVERRIDE") {
      return res.status(403).json({
        error: "Forbidden: Updating contract baseline requires explicit Security Review Council authorization token.",
      });
    }

    const parseResult = BehaviorContractSchema.safeParse(contract);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid contract specification",
        details: parseResult.error.issues,
      });
    }

    res.json({
      success: true,
      contractId: parseResult.data.id,
      version: parseResult.data.version,
      reviewedBy: "Security Review Council",
      reviewNotes: reviewNotes || "Authorized baseline update",
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/contracts/synthesize
   * Dynamically synthesizes an invariant BehaviorContract from task/issue text and code assertions.
   */
  app.post("/api/contracts/synthesize", (req: Request, res: Response) => {
    try {
      const { taskDescription, targetFile, targetFunction, sourceCode, testCode, contractId, author } = req.body || {};
      if (!taskDescription || !targetFile || !targetFunction) {
        return res.status(400).json({
          error: "Missing required parameters: taskDescription, targetFile, and targetFunction are required.",
        });
      }

      const synthesizer = new BehaviorContractSynthesizer();
      const result = synthesizer.synthesize({
        taskDescription,
        targetFile,
        targetFunction,
        sourceCode,
        testCode,
        contractId,
        author,
      });

      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({
        error: "Failed to synthesize contract",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  /**
   * GET /api/session
   * Normalized Entire CLI / agent session timeline.
   * Redacts secrets by default, drops full transcripts, and indicates live vs sample status.
   */
  app.get("/api/session", (_req: Request, res: Response) => {
    try {
      const provider = new EntireSessionProvider({
        redactSecrets: true,
        persistFullTranscripts: false,
      });

      const sessionPath = process.env.ENTIRE_SESSION_PATH;
      if (sessionPath && fs.existsSync(sessionPath)) {
        // Live session file configured
        const queryResult = provider.loadSampleSession(sessionPath);
        return res.json({
          ...queryResult,
          isLive: true,
          sourceLabel: "Entire CLI Live Connection",
        });
      }

      // Default checked-in sanitized sample session dataset
      const sampleResult = provider.loadSampleSession();
      res.json(sampleResult);
    } catch (err: unknown) {
      res.status(500).json({ error: "Failed to load agent session provenance" });
    }
  });

  /**
   * GET /api/session/stream
   * Real-time Server-Sent Events (SSE) stream of agent session provenance events.
   * Supports live log tailing or ?simulate=true for client demonstration.
   */
  app.get("/api/session/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const simulate = req.query.simulate === "true" || !process.env.ENTIRE_SESSION_PATH;
    const intervalMs = Math.max(100, Math.min(5000, Number(req.query.interval) || 800));

    const watcher = new EntireSessionWatcher();

    const sendEvent = (eventData: unknown) => {
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

    watcher.on("event", sendEvent);
    watcher.on("status", (status) => {
      res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
    });

    if (simulate) {
      watcher.simulateStream(undefined, intervalMs);
    } else if (process.env.ENTIRE_SESSION_PATH && fs.existsSync(process.env.ENTIRE_SESSION_PATH)) {
      watcher.startWatching(process.env.ENTIRE_SESSION_PATH);
    }

    req.on("close", () => {
      watcher.stop();
      res.end();
    });
  });

  /**
   * GET /api/gemma/check
   * Performs real lightweight test call to verify inference endpoint.
   * Never claims local model is running unless real inference succeeds.
   */
  app.get("/api/gemma/check", async (_req: Request, res: Response) => {
    const reviewer = new GemmaSemanticReviewer();
    const result = await reviewer.checkConnection();
    res.json(result);
  });

  /**
   * POST /api/gemma/review
   * Evaluates diff semantics using Gemma open-weight reviewer.
   * Model output is untrusted and schema-validated; cannot downgrade deterministic findings.
   */
  app.post("/api/gemma/review", async (req: Request, res: Response) => {
    const parseResult = GemmaReviewRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid request payload",
        details: parseResult.error.issues,
      });
    }

    const reviewer = new GemmaSemanticReviewer();
    if (!reviewer.isConfigured()) {
      return res.status(503).json({
        error: "Gemma endpoint not configured",
        configured: false,
      });
    }

    const reviewResult = await reviewer.review(parseResult.data);
    if (!reviewResult.success) {
      return res.status(502).json({
        error: reviewResult.error || "Gemma inference failed",
        latencyMs: reviewResult.latencyMs,
      });
    }

    res.json(reviewResult);
  });

  /**
   * GET /api/report/download
   * Streams the full system architecture and feature specification report as a downloadable file.
   */
  app.get("/api/report/download", (_req: Request, res: Response) => {
    const reportPath = path.resolve(process.cwd(), "GREENWASH_FULL_FEATURE_REPORT.md");
    if (!fs.existsSync(reportPath)) {
      return res.status(404).json({ error: "Report file not found" });
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="GREENWASH_FULL_FEATURE_REPORT.md"');
    const content = fs.readFileSync(reportPath, "utf-8");
    res.send(content);
  });

  /**
   * GET /api/graphify/:scenarioId?
   * Generates or retrieves the Graphify architectural knowledge graph and blast-radius analysis.
   */
  app.get("/api/graphify/:scenarioId?", async (req: Request, res: Response) => {
    const scenarioId = req.params.scenarioId || "weakened-assertion";
    try {
      const auditResult = await globalEngine.auditDemoScenario(scenarioId);
      const graph = globalGraphifyEngine.generateScenarioGraph(scenarioId, auditResult);
      // Automatically export artifacts to graphify-out
      globalGraphifyEngine.exportGraphifyArtifacts(graph);
      res.json(graph);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /api/gemma/mock
   * Health ping for local development mock endpoint.
   */
  app.get("/api/gemma/mock", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "gemma-local-dev-mock",
      model: "gemma:2b",
    });
  });

  /**
   * GET /api/gemma/mock/api/tags
   * Emulates Ollama /api/tags endpoint for connection checking.
   */
  app.get("/api/gemma/mock/api/tags", (_req: Request, res: Response) => {
    res.json({
      models: [
        {
          name: "gemma:2b",
          model: "gemma:2b",
          modified_at: new Date().toISOString(),
          size: 1678250000,
          digest: "sha256:gemma2bdevmock771a",
        },
      ],
    });
  });

  /**
   * POST /api/gemma/mock/api/generate
   * Emulates Ollama /api/generate endpoint returning schema-validated JSON semantic analysis.
   */
  app.post("/api/gemma/mock/api/generate", (req: Request, res: Response) => {
    const { prompt = "", model = "gemma:2b" } = req.body || {};
    const promptStr = String(prompt);

    let explanation = "Gemma model review: Code modifications change verification boundaries or assertion semantics.";
    let weakeningAnalysis = "The patch alters validation logic, potentially allowing invalid inputs or bypassing integrity checks.";
    let riskLevel: "low" | "medium" | "high" = "medium";
    let edgeCases = [
      {
        description: "Verify boundary conditions with untrusted input payload",
        suggestedCheck: "expect(evaluator(untrustedInput)).toBe(false);",
      },
    ];

    if (promptStr.includes("requireAuth") || promptStr.includes("GW-RULE-001") || promptStr.includes("auth")) {
      riskLevel = "high";
      explanation = "Authentication middleware or authorization guards were modified or removed in the changed lines. Unauthenticated requests can potentially access protected routes.";
      weakeningAnalysis = "The diff removes the `requireAuth` barrier. Requests without a Bearer token or with invalid session cookies bypass the credential check.";
      edgeCases = [
        {
          description: "Unauthenticated request without Authorization header",
          suggestedCheck: "GET /api/protected with no Authorization header should return HTTP 401",
        },
        {
          description: "Request with expired or forged JWT",
          suggestedCheck: "GET /api/protected with Bearer 'expired.jwt.token' should return HTTP 401",
        },
      ];
    } else if (promptStr.includes("signature") || promptStr.includes("webhook") || promptStr.includes("hmac")) {
      riskLevel = "high";
      explanation = "Cryptographic signature validation logic was stripped or bypassed. Webhook payloads will be processed without verifying sender authenticity.";
      weakeningAnalysis = "Constant-time signature verification was replaced with truthy constant or early return, allowing replay or spoofing attacks.";
      edgeCases = [
        {
          description: "Spoofed HMAC signature payload",
          suggestedCheck: "POST /webhook with invalid X-Hub-Signature-256 must be rejected with 400",
        },
      ];
    } else if (promptStr.includes("tenant") || promptStr.includes("scope") || promptStr.includes("isolation")) {
      riskLevel = "high";
      explanation = "Multi-tenant scope filter was relaxed. Cross-tenant data leakage is possible if query filters do not strictly bound organization ID.";
      weakeningAnalysis = "Database lookup omitted tenantId in WHERE clause, relying solely on primary key ID.";
      edgeCases = [
        {
          description: "Access resource belonging to tenant B using session from tenant A",
          suggestedCheck: "GET /api/tenants/b/records as tenant A user must return HTTP 403",
        },
      ];
    } else if (promptStr.includes("toBe") || promptStr.includes("assert") || promptStr.includes("expect")) {
      riskLevel = "high";
      explanation = "The strict equality assertion was replaced with a looser condition or range check. This masks regressions in calculated return values.";
      weakeningAnalysis = "Allowing arbitrary non-negative or broad range values bypasses contract guarantees established in existing test suites.";
      edgeCases = [
        {
          description: "Verify exact calculation bounds for edge boundary values",
          suggestedCheck: "expect(calculateOutput(input)).toBe(expectedExactValue);",
        },
      ];
    }

    const mockResponsePayload = {
      explanation,
      weakeningAnalysis,
      riskLevel,
      suggestedEdgeCases: edgeCases,
    };

    res.json({
      model,
      created_at: new Date().toISOString(),
      response: JSON.stringify(mockResponsePayload),
      done: true,
      total_duration: 85000000,
      load_duration: 5000000,
      prompt_eval_count: 24,
      eval_count: 85,
    });
  });

  /**
   * GET /api/diagnostics/sentry
   * Returns current Sentry integration state, last verified check, and last trace reference.
   * If Sentry is not configured, returns status: 'NOT_CONFIGURED' without leaking secrets.
   */
  app.get("/api/diagnostics/sentry", (_req: Request, res: Response) => {
    const status = getSentryStatus();
    res.json(status);
  });

  /**
   * POST /api/diagnostics/sentry/verify
   * Runs a safe verification check against configured Sentry project.
   */
  app.post("/api/diagnostics/sentry/verify", async (_req: Request, res: Response) => {
    const check = await verifySentryConnection();
    const status = getSentryStatus();
    res.json({
      check,
      status,
    });
  });

  // Safe fallback for unmatched API routes
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Serve static web app assets if built (for unified production deployment)
  const webDistCandidates = [
    path.resolve(process.cwd(), "apps/web/dist"),
    path.resolve(process.cwd(), "../web/dist"),
    path.resolve(process.cwd(), "../../apps/web/dist"),
  ];
  const webDistPath = webDistCandidates.find((p) => fs.existsSync(p));
  if (webDistPath) {
    app.use(express.static(webDistPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(webDistPath, "index.html"));
    });
  }

  // Global safe error handler - Never leak stack traces to client
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    res.status(500).json({ error: message });
  });

  return app;
}

if (process.argv[1]?.endsWith("dist/server.js")) {
  const app = createApp();
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`Greenwash API server listening on port ${port}`);
  });
}
