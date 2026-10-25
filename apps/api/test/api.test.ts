import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";

describe("Greenwash HTTP API Integration Tests", () => {
  const app = createApp();

  it("GET /api/health returns safe health status without leaking secrets", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe("0.1.0");
    expect(res.body.engine).toBe("Greenwash Core Engine");
    expect(res.body.secrets).toBeUndefined();
    expect(res.body.env).toBeUndefined();
  });

  it("GET /api/scenarios returns all 6 allow-listed demo scenarios", async () => {
    const res = await request(app).get("/api/scenarios");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(6);

    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain("weakened-assertion");
    expect(ids).toContain("honest-fix");
    expect(ids).toContain("deleted-test");
    expect(ids).toContain("skipped-test");
    expect(ids).toContain("excessive-mocking");
    expect(ids).toContain("weakened-ci-gate");
  });

  it("POST /api/audits/demo executes weakened-assertion and returns BLOCKED report", async () => {
    const res = await request(app)
      .post("/api/audits/demo")
      .send({ scenarioId: "weakened-assertion" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("BLOCKED");
    expect(res.body.scenarioId).toBe("weakened-assertion");
    expect(res.body.findings.length).toBeGreaterThan(0);

    const findingRules = res.body.findings.map((f: { ruleId: string }) => f.ruleId);
    expect(findingRules).toContain("AST-ASSERT-WEAKENED");
    expect(findingRules).toContain("CONTRACT-VIOLATION");

    // Step records & telemetry trace must be present
    expect(res.body.stepRecords).toBeDefined();
    expect(res.body.stepRecords.length).toBe(6);
    expect(res.body.trace).toBeDefined();
    expect(res.body.runId).toBeDefined();

    // Report should now be queryable by ID
    const reportId = res.body.id;
    const getRes = await request(app).get(`/api/audits/${reportId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(reportId);
  }, 15000);

  it("POST /api/audits/pipeline executes bounded Mastra workflow pipeline", async () => {
    const res = await request(app)
      .post("/api/audits/pipeline")
      .send({
        scenarioId: "weakened-assertion",
        options: {
          enableGemma: false,
          stepTimeoutMs: 5000,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.report.status).toBe("BLOCKED");
    expect(res.body.stepRecords.length).toBe(6);

    const step4 = res.body.stepRecords.find(
      (s: { stepId: string }) => s.stepId === "semantic-analysis"
    );
    expect(step4.status).toBe("omitted");
    expect(res.body.trace.stepsExecuted).toBe(5);
  });

  it("POST /api/audits/demo executes honest-fix and returns PASS report", async () => {
    const res = await request(app)
      .post("/api/audits/demo")
      .send({ scenarioId: "honest-fix" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PASS");
    expect(res.body.findings.length).toBe(0);
  });

  it("POST /api/audits/demo rejects unknown scenario IDs with HTTP 400", async () => {
    const res = await request(app)
      .post("/api/audits/demo")
      .send({ scenarioId: "arbitrary-unknown-id" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("is not an approved demo scenario");
  });

  it("POST /api/audits/demo rejects path traversal payload with HTTP 400", async () => {
    const res = await request(app)
      .post("/api/audits/demo")
      .send({ scenarioId: "../../etc/passwd" });

    expect(res.status).toBe(400);
  });

  it("POST /api/audits/demo rejects empty or invalid body with HTTP 400", async () => {
    const res = await request(app)
      .post("/api/audits/demo")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request payload");
  });

  it("GET /api/audits/:id returns 404 for non-existent report", async () => {
    const res = await request(app).get("/api/audits/non-existent-report-id");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });

  it("GET /api/audits lists audit summaries in sanitized schema", async () => {
    const res = await request(app).get("/api/audits");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const firstSummary = res.body[0];
    expect(firstSummary.id).toBeDefined();
    expect(firstSummary.status).toBeDefined();
    expect(firstSummary.checksSummary).toBeDefined();
  });

  it("GET /api/integrations/status returns honest status without secret leakage", async () => {
    const res = await request(app).get("/api/integrations/status");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const gemma = res.body.find((i: { id: string }) => i.id === "gemma");
    const entire = res.body.find((i: { id: string }) => i.id === "entire");
    const sentry = res.body.find((i: { id: string }) => i.id === "sentry");
    const mongo = res.body.find((i: { id: string }) => i.id === "mongodb");

    expect(gemma).toBeDefined();
    expect(["sample-only", "configured-not-verified"]).toContain(entire.state);
    expect(["not-configured", "configured-not-verified"]).toContain(sentry.state);
    expect(["not-configured", "configured-not-verified"]).toContain(mongo.state);

    // Must never leak connection strings or keys
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain("mongodb+srv://");
    expect(jsonStr).not.toContain("https://o");
  });

  it("GET /api/diagnostics/sentry returns accurate integration state without secrets", async () => {
    const res = await request(app).get("/api/diagnostics/sentry");
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
    expect(["CONFIGURED", "NOT_CONFIGURED", "INVALID"]).toContain(res.body.status);
    expect(res.body.redactionActive).toBe(true);
    expect(res.body.sampleRate).toBeDefined();

    // Verify no secret leakage
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("password");
    expect(text).not.toContain("secret");
  });

  it("POST /api/diagnostics/sentry/verify executes verification check safely", async () => {
    const res = await request(app).post("/api/diagnostics/sentry/verify");
    expect(res.status).toBe(200);
    expect(res.body.check).toBeDefined();
    expect(res.body.check.timestamp).toBeDefined();
    expect(["passed", "failed"]).toContain(res.body.check.status);
    expect(res.body.status).toBeDefined();
  });

  it("GET /api/history returns storageMode and records without leaking credentials", async () => {
    const res = await request(app).get("/api/history");
    expect(res.status).toBe(200);
    expect(["mongodb", "in-memory"]).toContain(res.body.storageMode);
    expect(typeof res.body.connected).toBe("boolean");
    expect(Array.isArray(res.body.records)).toBe(true);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("mongodb+srv://");
    expect(bodyStr).not.toContain("password");
  });

  it("GET /api/history/:id retrieves persisted report or 404 safely", async () => {
    // Non-existent ID returns 404
    const notFound = await request(app).get("/api/history/non-existent-audit-id");
    expect(notFound.status).toBe(404);
    expect(notFound.body.error).toContain("not found");

    // Run demo audit to create real report
    const demoRes = await request(app)
      .post("/api/audits/demo")
      .send({ scenarioId: "weakened-assertion" });
    expect(demoRes.status).toBe(200);
    const reportId = demoRes.body.id;

    // Fetch via /api/history/:id
    const historyRes = await request(app).get(`/api/history/${reportId}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.id).toBe(reportId);
    expect(historyRes.body.status).toBe("BLOCKED");
    expect(historyRes.body.findings).toBeDefined();
    expect(historyRes.body.schemaVersion).toBe(1);

    // Ensure raw diffs and full files are NOT in the persisted record
    expect(historyRes.body.rawDiff).toBeUndefined();
    expect(historyRes.body.sourceFile).toBeUndefined();
  }, 15000);

  it("GET /api/diagnostics/mongodb returns honest diagnostics without secret disclosure", async () => {
    const res = await request(app).get("/api/diagnostics/mongodb");
    expect(res.status).toBe(200);
    expect(["mongodb", "in-memory"]).toContain(res.body.mode);
    expect(typeof res.body.connected).toBe("boolean");
    expect(res.body.message).toBeDefined();

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("mongodb+srv://");
    expect(bodyStr).not.toContain("password");
  });

  it("POST /api/diagnostics/mongodb/verify verifies connection probe safely", async () => {
    const res = await request(app).post("/api/diagnostics/mongodb/verify");
    expect(res.status).toBe(200);
    expect(["mongodb", "in-memory"]).toContain(res.body.mode);
    expect(typeof res.body.connected).toBe("boolean");
  });

  it("GET /api/gemma/mock and /api/gemma/mock/api/tags emulate Ollama responses", async () => {
    const health = await request(app).get("/api/gemma/mock");
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");
    expect(health.body.service).toBe("gemma-local-dev-mock");

    const tags = await request(app).get("/api/gemma/mock/api/tags");
    expect(tags.status).toBe(200);
    expect(Array.isArray(tags.body.models)).toBe(true);
    expect(tags.body.models[0].name).toBe("gemma:2b");
  });

  it("POST /api/gemma/mock/api/generate returns valid semantic analysis JSON", async () => {
    const res = await request(app)
      .post("/api/gemma/mock/api/generate")
      .send({
        prompt: "RULE: GW-RULE-001 (requireAuth removed)\nFILE: src/auth.ts\n<diff_to_review>- requireAuth()\n+ // bypass</diff_to_review>",
        model: "gemma:2b",
      });

    expect(res.status).toBe(200);
    expect(res.body.model).toBe("gemma:2b");
    expect(typeof res.body.response).toBe("string");

    const parsed = JSON.parse(res.body.response);
    expect(parsed.explanation).toBeDefined();
    expect(parsed.riskLevel).toBe("high");
    expect(Array.isArray(parsed.suggestedEdgeCases)).toBe(true);
  });

  it("POST /api/contracts/synthesize generates valid contract from assertion testCode", async () => {
    const res = await request(app)
      .post("/api/contracts/synthesize")
      .send({
        taskDescription: "Calculate 10% coupon discount on purchase total",
        targetFile: "src/discount.ts",
        targetFunction: "calculateDiscount",
        testCode: 'expect(calculateDiscount(1000, 10)).toBe(900);',
      });

    expect(res.status).toBe(200);
    expect(res.body.contract).toBeDefined();
    expect(res.body.contract.targetFunction).toBe("calculateDiscount");
    expect(res.body.contract.cases.length).toBeGreaterThanOrEqual(1);
    expect(res.body.contract.cases[0].expected).toBe(900);
  });

  it("POST /api/contracts/synthesize rejects missing required fields with 400", async () => {
    const res = await request(app)
      .post("/api/contracts/synthesize")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required parameters");
  });
});
