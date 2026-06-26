const { normalizePhone } = require("../../utils/score");

function countPriorTransfersToCounterparty(matchedTransaction, transactionHistory) {
  const counterparty = normalizePhone(matchedTransaction.counterparty);
  if (!counterparty) {
    return 0;
  }

  return transactionHistory.filter(
    (txn) =>
      txn.id !== matchedTransaction.id &&
      txn.type === "transfer" &&
      txn.status === "completed" &&
      normalizePhone(txn.counterparty) === counterparty,
  ).length;
}

function evaluateEvidence(parsedComplaint, matchResult, transactionHistory = []) {
  const { matchedTransaction, ambiguous } = matchResult;
  const intent = parsedComplaint.intent;

  if (ambiguous) {
    return {
      evidenceVerdict: "insufficient_data",
      reasonCodes: ["ambiguous_match", "needs_clarification"],
    };
  }

  if (!matchedTransaction) {
    return {
      evidenceVerdict: "insufficient_data",
      reasonCodes: ["no_matching_transaction"],
    };
  }

  if (intent === "other") {
    return {
      evidenceVerdict: "insufficient_data",
      reasonCodes: ["ambiguous_intent"],
    };
  }

  if (intent === "payment_failed") {
    if (matchedTransaction.status === "completed") {
      return {
        evidenceVerdict: "inconsistent",
        reasonCodes: ["status_mismatch", "payment_reported_failed_but_completed"],
      };
    }
    if (matchedTransaction.status === "failed") {
      return {
        evidenceVerdict: "consistent",
        reasonCodes: ["status_match", "payment_failed_confirmed"],
      };
    }
    return {
      evidenceVerdict: "insufficient_data",
      reasonCodes: ["inconclusive_payment_status"],
    };
  }

  if (intent === "wrong_transfer") {
    if (matchedTransaction.status === "completed") {
      const priorTransfers = countPriorTransfersToCounterparty(
        matchedTransaction,
        transactionHistory,
      );
      if (priorTransfers >= 2) {
        return {
          evidenceVerdict: "inconsistent",
          reasonCodes: [
            "wrong_transfer_claim",
            "established_recipient_pattern",
            "evidence_inconsistent",
          ],
        };
      }
      return {
        evidenceVerdict: "consistent",
        reasonCodes: ["status_match", "completed_transfer_found"],
      };
    }
    return {
      evidenceVerdict: "insufficient_data",
      reasonCodes: ["transfer_not_completed"],
    };
  }

  if (intent === "refund_request") {
    if (matchedTransaction.status === "reversed") {
      return {
        evidenceVerdict: "consistent",
        reasonCodes: ["refund_already_reversed"],
      };
    }
    if (matchedTransaction.status === "completed") {
      return {
        evidenceVerdict: "consistent",
        reasonCodes: ["refund_request", "merchant_policy_dependent"],
      };
    }
    return {
      evidenceVerdict: "insufficient_data",
      reasonCodes: ["refund_status_unclear"],
    };
  }

  if (intent === "phishing_or_social_engineering") {
    return {
      evidenceVerdict: "insufficient_data",
      reasonCodes: ["fraud_requires_manual_review"],
    };
  }

  if (intent === "duplicate_payment") {
    if (matchedTransaction.status === "completed") {
      return {
        evidenceVerdict: "consistent",
        reasonCodes: ["duplicate_payment_consistent"],
      };
    }
    return {
      evidenceVerdict: "insufficient_data",
      reasonCodes: ["duplicate_payment_requires_completed_transactions"],
    };
  }

  if (intent === "merchant_settlement_delay") {
    if (matchedTransaction.status === "pending") {
      return {
        evidenceVerdict: "consistent",
        reasonCodes: ["pending_settlement_found"],
      };
    }
    return {
      evidenceVerdict: "inconsistent",
      reasonCodes: ["settlement_not_pending"],
    };
  }

  if (intent === "agent_cash_in_issue") {
    if (matchedTransaction.status === "pending") {
      return {
        evidenceVerdict: "consistent",
        reasonCodes: ["pending_cash_in_found"],
      };
    }
    if (matchedTransaction.status === "completed") {
      return {
        evidenceVerdict: "consistent",
        reasonCodes: ["completed_cash_in_found"],
      };
    }
    return {
      evidenceVerdict: "insufficient_data",
      reasonCodes: ["cash_in_status_unclear"],
    };
  }

  return {
    evidenceVerdict: "insufficient_data",
    reasonCodes: ["unhandled_intent"],
  };
}

module.exports = { evaluateEvidence };
