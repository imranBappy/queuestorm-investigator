const { evaluateEvidence } = require("../../src/services/investigation/evidence-engine");
const { applyRules } = require("../../src/services/investigation/rule-engine");
const { routeDepartment } = require("../../src/services/investigation/department-router");
const { determineSeverity } = require("../../src/services/investigation/severity-engine");
const { classifyCase } = require("../../src/services/investigation/classifier");

const completedTxn = {
  id: "txn_1",
  amount: 5000,
  type: "transfer",
  status: "completed",
  timestamp: "2026-06-26T14:00:00Z",
};

describe("evidence-engine", () => {
  test("payment failed + completed = inconsistent", () => {
    const result = evaluateEvidence(
      { intent: "payment_failed" },
      { matchedTransaction: completedTxn },
    );
    expect(result.evidenceVerdict).toBe("inconsistent");
  });

  test("wrong transfer + completed = consistent", () => {
    const result = evaluateEvidence(
      { intent: "wrong_transfer" },
      { matchedTransaction: completedTxn },
    );
    expect(result.evidenceVerdict).toBe("consistent");
  });

  test("no match = insufficient_data", () => {
    const result = evaluateEvidence({ intent: "refund_request" }, { matchedTransaction: null });
    expect(result.evidenceVerdict).toBe("insufficient_data");
  });
});

describe("rule-engine", () => {
  test("wrong transfer routes to dispute_resolution with human review", () => {
    const parsed = { intent: "wrong_transfer", parserConfidence: 0.8 };
    const evidence = { evidenceVerdict: "consistent", reasonCodes: ["status_match"] };
    const match = { reasonCodes: ["amount_match"], relevantTransactionId: "txn_1" };

    const result = applyRules(parsed, evidence, match);
    expect(result.caseType).toBe("wrong_transfer");
    expect(result.department).toBe("dispute_resolution");
    expect(result.severity).toBe("high");
    expect(result.humanReviewRequired).toBe(true);
  });

  test("phishing escalates to fraud_risk critical", () => {
    const parsed = { intent: "phishing_or_social_engineering", parserConfidence: 0.9 };
    const evidence = { evidenceVerdict: "insufficient_data", reasonCodes: [] };
    const match = { reasonCodes: [], relevantTransactionId: null };

    const result = applyRules(parsed, evidence, match);
    expect(result.department).toBe("fraud_risk");
    expect(result.severity).toBe("critical");
  });
});

describe("department-router", () => {
  test("routes payment_failed inconsistent to payments_ops", () => {
    expect(routeDepartment("payment_failed", "inconsistent")).toBe("payments_ops");
  });
});

describe("severity-engine", () => {
  test("assigns high severity for inconsistent payment_failed", () => {
    expect(determineSeverity("payment_failed", "inconsistent")).toBe("high");
  });
});

describe("classifier", () => {
  test("marks vague other intent as needing clarification without ambiguity flag", () => {
    const result = classifyCase({ intent: "other", parserConfidence: 0.4 }, "insufficient_data");
    expect(result.caseType).toBe("other");
    expect(result.ambiguous).toBe(false);
    expect(result.reasonCodes).toContain("vague_complaint");
  });
});
