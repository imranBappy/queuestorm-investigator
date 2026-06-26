function buildLlmFallbackResponse(partial = {}) {
  return {
    relevant_transaction_id: partial.relevant_transaction_id ?? null,
    evidence_verdict: partial.evidence_verdict ?? "insufficient_data",
    case_type: partial.case_type ?? "other",
    severity: partial.severity ?? "medium",
    department: partial.department ?? "customer_support",
    agent_summary:
      partial.agent_summary ??
      "We could not finish the automated review. This case needs a human investigator.",
    recommended_next_action:
      partial.recommended_next_action ??
      "Assign to an investigator and verify the transaction records through official channels.",
    customer_reply:
      partial.customer_reply ??
      "Thanks for contacting us. We have your case and our support team will review it and follow up through official channels.",
    human_review_required: true,
    confidence: 0.3,
    reason_codes: [
      ...new Set([
        ...(partial.reason_codes || []),
        ...((partial.reason_codes || []).includes("llm_not_configured") ||
        (partial.reason_codes || []).includes("llm_error")
          ? []
          : ["llm_timeout"]),
      ]),
    ],
  };
}

module.exports = { buildLlmFallbackResponse };
