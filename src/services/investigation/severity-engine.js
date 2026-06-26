function determineSeverity(caseType, evidenceVerdict) {
  if (caseType === "phishing_or_social_engineering") {
    return "critical";
  }

  if (caseType === "wrong_transfer") {
    return evidenceVerdict === "insufficient_data"
      ? "medium"
      : evidenceVerdict === "inconsistent"
        ? "medium"
        : "high";
  }

  if (caseType === "duplicate_payment" || caseType === "agent_cash_in_issue") {
    return "high";
  }

  if (caseType === "payment_failed") {
    return "high";
  }

  if (caseType === "refund_request") {
    return "low";
  }

  if (caseType === "merchant_settlement_delay") {
    return "medium";
  }

  if (evidenceVerdict === "insufficient_data") {
    return caseType === "other" ? "low" : "medium";
  }

  return "low";
}

module.exports = { determineSeverity };
