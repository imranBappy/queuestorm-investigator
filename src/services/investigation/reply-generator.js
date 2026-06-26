const CASE_LABELS = {
  wrong_transfer: "wrong transfer",
  payment_failed: "failed payment",
  refund_request: "refund request",
  duplicate_payment: "duplicate payment",
  merchant_settlement_delay: "settlement delay",
  agent_cash_in_issue: "cash-in issue",
  phishing_or_social_engineering: "security concern",
  other: "general complaint",
};

const TEAM_LABELS = {
  dispute_resolution: "dispute team",
  payments_ops: "payments team",
  merchant_operations: "merchant operations team",
  agent_operations: "agent operations team",
  fraud_risk: "fraud and risk team",
  customer_support: "support team",
};

function formatAmount(amount, currency = "BDT") {
  if (amount == null) return null;
  return `${Number(amount).toLocaleString("en-US")} ${currency}`;
}

function txnContext(matchResult) {
  const txn = matchResult.matchedTransaction;
  if (!txn) return null;

  return {
    id: txn.id,
    amount: formatAmount(txn.amount, txn.currency),
    counterparty: txn.counterparty,
    merchant: txn.merchant,
    status: txn.status,
  };
}

function buildAgentSummary(caseType, evidenceVerdict, matchResult, parsedComplaint) {
  const label = CASE_LABELS[caseType] || caseType.replace(/_/g, " ");
  const txn = txnContext(matchResult);

  if (!txn) {
    if (parsedComplaint.amount) {
      return `Customer reported a ${label} involving about ${formatAmount(parsedComplaint.amount)}, but no transaction in the history clearly matches their description.`;
    }
    return `Customer reported a ${label}, but we could not confidently match a transaction from the history provided.`;
  }

  const amountPart = txn.amount ? `${txn.amount} ` : "";
  const destination = txn.counterparty || txn.merchant;

  if (caseType === "wrong_transfer") {
    const destPart = destination ? ` to ${destination}` : "";
    return `Customer reports sending ${amountPart}via ${txn.id}${destPart} and believes the recipient was wrong. Transaction status is ${txn.status}.`;
  }

  if (caseType === "payment_failed") {
    if (evidenceVerdict === "inconsistent") {
      return `Customer says a payment failed, but ${txn.id} for ${txn.amount || "the reported amount"} shows as ${txn.status} in our records.`;
    }
    return `Customer reported a failed payment. Matched ${txn.id} (${txn.status}).`;
  }

  if (caseType === "duplicate_payment") {
    return `Customer believes they were charged twice. Latest matching transaction is ${txn.id} for ${txn.amount || "the reported amount"} (${txn.status}).`;
  }

  if (caseType === "refund_request") {
    return `Customer is asking for a refund related to ${txn.id} (${txn.amount || "amount on file"}, status: ${txn.status}).`;
  }

  if (caseType === "merchant_settlement_delay") {
    const merchantPart = txn.merchant ? ` for ${txn.merchant}` : "";
    return `Merchant reports delayed settlement on ${txn.id}${merchantPart}. Current status is ${txn.status}.`;
  }

  if (caseType === "agent_cash_in_issue") {
    return `Agent or customer flagged a cash-in problem on ${txn.id} (${txn.amount || "amount on file"}, status: ${txn.status}).`;
  }

  if (caseType === "phishing_or_social_engineering") {
    return `Customer reported a possible scam or social-engineering attempt. ${txn.id ? `Mentioned transaction: ${txn.id}.` : "No clear transaction match."}`;
  }

  return `Customer complaint looks like a ${label}. Best match is ${txn.id}${destination ? ` (${destination})` : ""}, status ${txn.status}. Evidence: ${evidenceVerdict.replace(/_/g, " ")}.`;
}

function buildRecommendedAction(caseType, evidenceVerdict, humanReviewRequired, matchResult) {
  const txn = txnContext(matchResult);
  const txnRef = txn?.id ? ` ${txn.id}` : "";

  if (caseType === "wrong_transfer") {
    return `Confirm${txnRef ? ` ${txnRef}` : " transaction"} details with the customer, then open the wrong-transfer dispute workflow. Do not promise a reversal.`;
  }
  if (caseType === "phishing_or_social_engineering") {
    return "Escalate to the fraud team right away. Secure the account and review recent activity before replying to the customer.";
  }
  if (caseType === "payment_failed" && evidenceVerdict === "inconsistent") {
    return `Check gateway logs against the customer's report${txnRef ? ` for${txnRef}` : ""}. They may have been debited even though they saw a failure message.`;
  }
  if (caseType === "duplicate_payment") {
    return `Ask payments ops to verify whether a duplicate charge occurred${txnRef ? ` around${txnRef}` : ""}. Only start a reversal if the biller confirms two payments were received.`;
  }
  if (caseType === "merchant_settlement_delay") {
    return "Have merchant operations check the settlement batch and share a realistic ETA if it is delayed.";
  }
  if (caseType === "agent_cash_in_issue") {
    return `Follow up with agent operations on the cash-in status${txnRef ? ` for${txnRef}` : ""} and resolve within the standard SLA.`;
  }
  if (evidenceVerdict === "insufficient_data") {
    return "Ask the customer for more transaction details, then verify against core banking records before taking action.";
  }
  if (humanReviewRequired) {
    return "Hand this to the assigned team for a manual check before making any commitments to the customer.";
  }
  return "Log the findings and keep monitoring until the case is closed through official support.";
}

function buildCustomerReply(caseType, evidenceVerdict, matchResult, ruleResult) {
  const txn = txnContext(matchResult);
  const txnRef = txn?.id ? ` transaction ${txn.id}` : " your transaction";
  const team = TEAM_LABELS[ruleResult.department] || "support team";

  if (caseType === "wrong_transfer") {
    return `We have noted your concern about${txnRef}. Please do not share your PIN or OTP with anyone. Our ${team} will review the case and contact you through official support channels.`;
  }
  if (caseType === "payment_failed" && evidenceVerdict === "inconsistent") {
    return `Thanks for letting us know about the payment issue${txn?.id ? ` on ${txn.id}` : ""}. We are checking whether the payment went through despite the failure message you saw. Our ${team} will follow up through official support.`;
  }
  if (caseType === "refund_request") {
    return `We have logged your refund request${txn?.id ? ` for ${txn.id}` : ""}. Our team will verify the transaction and get back to you through official support. We cannot confirm a refund until the review is finished.`;
  }
  if (caseType === "duplicate_payment") {
    return `We have noted the possible duplicate charge${txn?.id ? ` related to ${txn.id}` : ""}. Our ${team} will check with the biller and, if a duplicate is confirmed, process any eligible return through official channels. Please never share your PIN or OTP.`;
  }
  if (caseType === "merchant_settlement_delay") {
    return `We have received your settlement concern${txn?.id ? ` for ${txn.id}` : ""}. Our ${team} will check the batch status and update you on the expected timing through official channels.`;
  }
  if (caseType === "agent_cash_in_issue") {
    return `We are looking into the cash-in issue${txn?.id ? ` on ${txn.id}` : ""}. Our ${team} will investigate and update you soon through official channels. Please do not share your PIN or OTP with anyone.`;
  }
  if (caseType === "phishing_or_social_engineering") {
    return "We take security concerns seriously and have escalated your report to our fraud team. Never share your PIN, OTP, or password with anyone. Contact official support immediately if you think your account may be at risk.";
  }
  return `Thank you for reaching out. We are reviewing your complaint and will respond through our official support channels once verification is complete.`;
}

function generateReplies(parsedComplaint, ruleResult, evidenceResult, matchResult) {
  const { caseType, humanReviewRequired } = ruleResult;
  const { evidenceVerdict } = evidenceResult;

  return {
    agent_summary: buildAgentSummary(caseType, evidenceVerdict, matchResult, parsedComplaint),
    recommended_next_action: buildRecommendedAction(
      caseType,
      evidenceVerdict,
      humanReviewRequired,
      matchResult,
    ),
    customer_reply: buildCustomerReply(caseType, evidenceVerdict, matchResult, ruleResult),
  };
}

module.exports = { generateReplies };
