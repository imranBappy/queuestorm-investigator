function routeDepartment(caseType, evidenceVerdict) {
  switch (caseType) {
    case "wrong_transfer":
      return "dispute_resolution";
    case "payment_failed":
      return "payments_ops";
    case "refund_request":
      return "customer_support";
    case "duplicate_payment":
      return "payments_ops";
    case "merchant_settlement_delay":
      return "merchant_operations";
    case "agent_cash_in_issue":
      return "agent_operations";
    case "phishing_or_social_engineering":
      return "fraud_risk";
    default:
      return "customer_support";
  }
}

module.exports = { routeDepartment };
