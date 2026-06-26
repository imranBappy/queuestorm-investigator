const {
  matchTransaction,
  scoreTransaction,
} = require("../../src/services/investigation/transaction-matcher");

const parsedComplaint = {
  amount: 5000,
  transactionType: "transfer",
  phoneNumbers: ["01712345678"],
  merchant: null,
  time: "2pm",
};

const transactions = [
  {
    id: "txn_abc123",
    amount: 5000,
    currency: "BDT",
    type: "transfer",
    counterparty: "01712345678",
    merchant: null,
    timestamp: "2026-06-26T14:05:00Z",
    status: "completed",
  },
  {
    id: "txn_other",
    amount: 100,
    currency: "BDT",
    type: "payment",
    counterparty: "01800000000",
    merchant: "Shop",
    timestamp: "2026-06-25T10:00:00Z",
    status: "completed",
  },
];

describe("transaction-matcher", () => {
  test("scores matching transaction highly", () => {
    const { score } = scoreTransaction(parsedComplaint, transactions[0]);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  test("returns best match above threshold", () => {
    const result = matchTransaction(parsedComplaint, transactions);
    expect(result.relevantTransactionId).toBe("txn_abc123");
    expect(result.reasonCodes).toContain("amount_match");
  });

  test("returns null for empty history", () => {
    const result = matchTransaction(parsedComplaint, []);
    expect(result.relevantTransactionId).toBeNull();
    expect(result.reasonCodes).toContain("no_transaction_history");
  });

  test("returns null when no confident match", () => {
    const result = matchTransaction(
      { amount: 99999, transactionType: "withdrawal", phoneNumbers: [], merchant: null, time: null },
      transactions,
    );
    expect(result.relevantTransactionId).toBeNull();
  });
});
