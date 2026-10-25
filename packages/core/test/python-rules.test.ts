import { describe, it, expect } from "vitest";
import { PythonDiffScanner } from "../src/rules/pythonScanner.js";
import { DeterministicDiffScanner } from "../src/rules/scanner.js";

describe("Python & Pytest AST Rules Tests", () => {
  const pythonScanner = new PythonDiffScanner();
  const fullScanner = new DeterministicDiffScanner();

  it("detects weakened assertion in pytest file (assert x == 900 -> assert x >= 0)", () => {
    const diff = `diff --git a/tests/test_billing.py b/tests/test_billing.py
index 1234567..89abcdef 100644
--- a/tests/test_billing.py
+++ b/tests/test_billing.py
@@ -10,3 +10,3 @@ def test_coupon_discount():
     total = calculate_discount(1000, 10)
-    assert total == 900
+    assert total >= 0
`;

    const result = pythonScanner.scan(diff);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].ruleId).toBe("PY-ASSERT-WEAKENED");
    expect(result.findings[0].severity).toBe("critical");
    expect(result.findings[0].reproductionCommand).toBe("pytest tests/test_billing.py");

    // Also verified in full engine scanner
    const fullResult = fullScanner.scan(diff);
    const pyFinding = fullResult.findings.find((f) => f.ruleId === "PY-ASSERT-WEAKENED");
    expect(pyFinding).toBeDefined();
  });

  it("detects injected @pytest.mark.skip decorator", () => {
    const diff = `diff --git a/tests/test_auth.py b/tests/test_auth.py
index 1234567..89abcdef 100644
--- a/tests/test_auth.py
+++ b/tests/test_auth.py
@@ -5,2 +5,3 @@
+@pytest.mark.skip(reason="WIP bypass")
 def test_jwt_signature_verification():
     assert verify_token(sample_token) is True
`;

    const result = pythonScanner.scan(diff);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].ruleId).toBe("PY-TEST-SKIPPED");
    expect(result.findings[0].evidence[0].detail).toContain("@pytest.mark.skip");
  });

  it("detects deleted pytest function (def test_concurrency)", () => {
    const diff = `diff --git a/tests/test_concurrency.py b/tests/test_concurrency.py
index 1234567..89abcdef 100644
--- a/tests/test_concurrency.py
+++ b/tests/test_concurrency.py
@@ -15,5 +15,0 @@
-def test_concurrent_transfers_no_deadlock():
-    account = Account(1000)
-    run_parallel_withdrawals(account)
-    assert account.balance == 500
`;

    const result = pythonScanner.scan(diff);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].ruleId).toBe("PY-TEST-DELETED");
    expect(result.findings[0].summary).toContain("test_concurrent_transfers_no_deadlock");
  });

  it("ignores non-python test files", () => {
    const diff = `diff --git a/src/main.py b/src/main.py
index 1234567..89abcdef 100644
--- a/src/main.py
+++ b/src/main.py
@@ -1,2 +1,2 @@
-x = 1
+x = 2
`;

    const result = pythonScanner.scan(diff);
    expect(result.findings.length).toBe(0);
  });
});
