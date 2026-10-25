import { describe, it, expect } from "vitest";
import {
  DeterministicDiffScanner,
  AssertionWeakeningRule,
  TestDeletionRule,
  TestSkippingRule,
  MockSubstitutionRule,
  CiGateWeakeningRule,
  ContractModificationRule,
  safeParseDiff,
} from "../src/index.js";

describe("Deterministic Core Rules Engine", () => {
  const scanner = new DeterministicDiffScanner();

  // ==========================================
  // Rule 1: Assertion Weakening
  // ==========================================
  describe("Rule 1: Assertion Weakening (AST-ASSERT-WEAKENED)", () => {
    it("detects weakening from toBe(900) to toBeGreaterThanOrEqual(0)", () => {
      const diff = `--- a/tests/discount.test.ts
+++ b/tests/discount.test.ts
@@ -6,3 +6,3 @@
     const discounted = calculateDiscount(1000, 10);
-    expect(discounted).toBe(900);
+    expect(discounted).toBeGreaterThanOrEqual(0);
   });`;

      const result = scanner.scan(diff);
      const finding = result.findings.find((f) => f.ruleId === "AST-ASSERT-WEAKENED");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("critical");
      expect(finding?.evidence[0].startLine).toBe(7);
      expect(finding?.humanAction).toContain("Reject patch");
    });

    it("detects python equality assertion weakened to >= 0", () => {
      const diff = `--- a/tests/test_billing.py
+++ b/tests/test_billing.py
@@ -42,3 +42,3 @@
-    assert balance == 150.0
+    assert balance >= 0
   `;

      const result = scanner.scan(diff);
      expect(result.findings.some((f) => f.ruleId === "AST-ASSERT-WEAKENED")).toBe(true);
    });

    it("does not flag legitimate assertion update between strict values", () => {
      const diff = `--- a/tests/discount.test.ts
+++ b/tests/discount.test.ts
@@ -6,3 +6,3 @@
-    expect(discounted).toBe(900);
+    expect(discounted).toBe(850);
   });`;

      const result = scanner.scan(diff);
      expect(result.findings.some((f) => f.ruleId === "AST-ASSERT-WEAKENED")).toBe(false);
    });
  });

  // ==========================================
  // Rule 2: Test Deletion
  // ==========================================
  describe("Rule 2: Test Deletion (AST-TEST-DELETED)", () => {
    it("detects deleted it() test case", () => {
      const diff = `--- a/tests/account.test.ts
+++ b/tests/account.test.ts
@@ -7,5 +7,0 @@
-  it("handles concurrent withdrawals without deadlock", () => {
-    const deadlockDetected = true;
-    expect(deadlockDetected).toBe(false);
-  });`;

      const result = scanner.scan(diff);
      const finding = result.findings.find((f) => f.ruleId === "AST-TEST-DELETED");
      expect(finding).toBeDefined();
      expect(finding?.summary).toContain("handles concurrent withdrawals without deadlock");
    });

    it("detects deleted python def test_...()", () => {
      const diff = `--- a/tests/test_concurrency.py
+++ b/tests/test_concurrency.py
@@ -10,4 +10,0 @@
-def test_deadlock_condition():
-    assert solve_deadlock() is True
-`;
      const result = scanner.scan(diff);
      expect(result.findings.some((f) => f.ruleId === "AST-TEST-DELETED")).toBe(true);
    });

    it("does not flag regular code deletion in non-test source files", () => {
      const diff = `--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,2 +10,0 @@
-function unusedHelper() {
-}`;
      const result = scanner.scan(diff);
      expect(result.findings.some((f) => f.ruleId === "AST-TEST-DELETED")).toBe(false);
    });
  });

  // ==========================================
  // Rule 3: Test Skipping / Disablement
  // ==========================================
  describe("Rule 3: Test Skipping (AST-TEST-SKIPPED)", () => {
    it("detects it.skip directive", () => {
      const diff = `--- a/tests/webhook.test.ts
+++ b/tests/webhook.test.ts
@@ -3,2 +3,2 @@
-  it("verifies stripe webhook cryptographic signature", () => {
+  it.skip("verifies stripe webhook cryptographic signature", () => {
   `;
      const result = scanner.scan(diff);
      const finding = result.findings.find((f) => f.ruleId === "AST-TEST-SKIPPED");
      expect(finding).toBeDefined();
      expect(finding?.evidence[0].title).toContain("it.skip");
    });

    it("detects @pytest.mark.skip decorator", () => {
      const diff = `--- a/tests/test_gateway.py
+++ b/tests/test_gateway.py
@@ -12,2 +12,3 @@
+@pytest.mark.skip(reason="Fails in CI")
 def test_webhook_handler():
 `;
      const result = scanner.scan(diff);
      expect(result.findings.some((f) => f.ruleId === "AST-TEST-SKIPPED")).toBe(true);
    });

    it("detects xit() and test.only() modifiers", () => {
      const diff = `--- a/tests/auth.test.ts
+++ b/tests/auth.test.ts
@@ -5,2 +5,2 @@
-  test("validates user", () => {});
+  test.only("validates user", () => {});
 `;
      const result = scanner.scan(diff);
      expect(result.findings.some((f) => f.ruleId === "AST-TEST-SKIPPED")).toBe(true);
    });
  });

  // ==========================================
  // Rule 4: Mock Substitution
  // ==========================================
  describe("Rule 4: Mock Substitution (AST-MOCK-SUBSTITUTION)", () => {
    it("detects vi.spyOn mockReturnValue override", () => {
      const diff = `--- a/tests/auth.test.ts
+++ b/tests/auth.test.ts
@@ -8,2 +8,3 @@
   it("authenticates token", () => {
+    vi.spyOn(TokenValidator, "verify").mockReturnValue(true);
     expect(TokenValidator.verify("expired-token")).toBe(true);
 `;
      const result = scanner.scan(diff);
      const finding = result.findings.find((f) => f.ruleId === "AST-MOCK-SUBSTITUTION");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("medium");
    });

    it("detects python unittest @patch decorator", () => {
      const diff = `--- a/tests/test_service.py
+++ b/tests/test_service.py
@@ -10,2 +10,3 @@
+@patch("services.auth.verify_token", return_value=True)
 def test_auth_route(mock_verify):
 `;
      const result = scanner.scan(diff);
      expect(result.findings.some((f) => f.ruleId === "AST-MOCK-SUBSTITUTION")).toBe(true);
    });
  });

  // ==========================================
  // Rule 5: CI Gate Weakening
  // ==========================================
  describe("Rule 5: CI Gate Weakening (CI-GATE-SUPPRESSION & CI-THRESHOLD-REDUCED)", () => {
    it("detects continue-on-error and || true suppression", () => {
      const diff = `--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -8,2 +8,3 @@
-        run: npm run test:coverage -- --min-coverage=80
+        run: npm run test:coverage -- --min-coverage=50 || true
+        continue-on-error: true
 `;
      const result = scanner.scan(diff);
      const gateFinding = result.findings.find((f) => f.ruleId === "CI-GATE-SUPPRESSION");
      const thresholdFinding = result.findings.find((f) => f.ruleId === "CI-THRESHOLD-REDUCED");

      expect(gateFinding).toBeDefined();
      expect(thresholdFinding).toBeDefined();
      expect(thresholdFinding?.expected).toBe("80%");
      expect(thresholdFinding?.actual).toBe("50%");
    });
  });

  // ==========================================
  // Rule 6: Contract Modification
  // ==========================================
  describe("Rule 6: Contract Modification (CONTRACT-MODIFIED)", () => {
    it("detects modification to contract fixtures", () => {
      const diff = `--- a/fixtures/contracts/billing-discount.contract.json
+++ b/fixtures/contracts/billing-discount.contract.json
@@ -10,2 +10,2 @@
-      "expected": 900
+      "expected": 1000
 `;
      const result = scanner.scan(diff);
      const finding = result.findings.find((f) => f.ruleId === "CONTRACT-MODIFIED");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("critical");
      expect(finding?.humanAction).toContain("Reject patch immediately");
    });
  });

  // ==========================================
  // Multi-File & Edge Case Boundaries
  // ==========================================
  describe("Multi-File & Edge Case Boundaries", () => {
    it("handles multi-file unified diff correctly", () => {
      const multiDiff = `diff --git a/tests/discount.test.ts b/tests/discount.test.ts
--- a/tests/discount.test.ts
+++ b/tests/discount.test.ts
@@ -6,3 +6,3 @@
     const discounted = calculateDiscount(1000, 10);
-    expect(discounted).toBe(900);
+    expect(discounted).toBeGreaterThanOrEqual(0);
   });
diff --git a/tests/webhook.test.ts b/tests/webhook.test.ts
--- a/tests/webhook.test.ts
+++ b/tests/webhook.test.ts
@@ -3,2 +3,2 @@
-  it("verifies webhook", () => {
+  it.skip("verifies webhook", () => {
   });`;
      const result = scanner.scan(multiDiff);
      const ruleIds = result.findings.map((f) => f.ruleId);
      expect(ruleIds).toContain("AST-ASSERT-WEAKENED");
      expect(ruleIds).toContain("AST-TEST-SKIPPED");
      expect(result.checks.find((c) => c.id === "check-diff-parse")?.status).toBe("passed");
    });

    it("handles empty diff cleanly", () => {
      const result = scanner.scan("");
      expect(result.findings.length).toBe(0);
      expect(result.checks[0].status).toBe("warning");
    });

    it("handles malformed diff without throwing; never issues a false PASS", () => {
      const result = scanner.scan("this is completely invalid diff gibberish");
      expect(result.findings.length).toBe(0);
      expect(result.checks[0].status).toBe("warning");
      expect(result.parseError).toBe("Malformed unified diff");
    });

    it("passes honest fix diff without any false positive findings", () => {
      const honestDiff = `--- a/src/discount.ts
+++ b/src/discount.ts
@@ -7,2 +7,3 @@
-  return amountCents;
+  const discountAmount = Math.round((amountCents * discountPercent) / 100);
+  return amountCents - discountAmount;
 }`;
      const result = scanner.scan(honestDiff);
      expect(result.findings.length).toBe(0);
      expect(result.checks.every((c) => c.status === "passed")).toBe(true);
    });
  });
});
