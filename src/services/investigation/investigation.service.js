const { parseComplaint } = require("./complaint-parser");
const { matchTransaction } = require("./transaction-matcher");
const { evaluateEvidence } = require("./evidence-engine");
const { applyRules } = require("./rule-engine");
const { generateReplies } = require("./reply-generator");
const LlmService = require("../llm.service");
const { scrubResponseFields } = require("../../utils/output-safety");
const { validateAnalyzeResponse } = require("../../validators/response.validator");

const LLM_LANGUAGES = new Set(["bn", "banglish", "mixed"]);

function needsLlm(parsedComplaint, ruleResult) {
  if (LLM_LANGUAGES.has(parsedComplaint.language)) return true;
  if (ruleResult.ambiguous) return true;
  if (parsedComplaint.parserConfidence < 0.6) return true;
  return false;
}

class InvestigationService {
  constructor({ llmService } = {}) {
    this.llmService = llmService || new LlmService();
  }

  async investigate({ ticket_id, complaint, transaction_history: transactionHistory }) {
    const start = Date.now();
    const parsedComplaint = parseComplaint(complaint);
    const matchResult = matchTransaction(parsedComplaint, transactionHistory);
    const evidenceResult = evaluateEvidence(
      parsedComplaint,
      matchResult,
      transactionHistory || [],
    );
    const ruleResult = applyRules(parsedComplaint, evidenceResult, matchResult);

    const templateReplies = generateReplies(
      parsedComplaint,
      ruleResult,
      evidenceResult,
      matchResult,
    );

    let response = {
      ticket_id,
      relevant_transaction_id: matchResult.relevantTransactionId,
      evidence_verdict: evidenceResult.evidenceVerdict,
      case_type: ruleResult.caseType,
      severity: ruleResult.severity,
      department: ruleResult.department,
      agent_summary: templateReplies.agent_summary,
      recommended_next_action: templateReplies.recommended_next_action,
      customer_reply: templateReplies.customer_reply,
      human_review_required: ruleResult.humanReviewRequired,
      confidence: ruleResult.confidence,
      reason_codes: ruleResult.reasonCodes,
    };

    let llmUsed = false;
    let tokens;

    if (needsLlm(parsedComplaint, ruleResult)) {
      const llmResult = await this.llmService.generateInvestigationContent(
        { complaint, parsedComplaint, transactionHistory },
        response,
      );

      if (!llmResult || llmResult.relevant_transaction_id === undefined) {
        response = {
          ...response,
          agent_summary: llmResult?.agent_summary || response.agent_summary,
          recommended_next_action:
            llmResult?.recommended_next_action || response.recommended_next_action,
          customer_reply: llmResult?.customer_reply || response.customer_reply,
          human_review_required:
            llmResult?.human_review_required ?? response.human_review_required,
          confidence: llmResult?.confidence ?? response.confidence,
          reason_codes: llmResult?.reason_codes
            ? [...new Set([...response.reason_codes, ...llmResult.reason_codes])]
            : response.reason_codes,
        };
        llmUsed = llmResult?.llmUsed ?? false;
        tokens = llmResult?.tokens;
      } else {
        response = {
          ...response,
          ...llmResult,
          relevant_transaction_id: matchResult.relevantTransactionId,
        };
      }
      response.reason_codes = [...new Set([...response.reason_codes, "llm_assisted"])];
    } else {
      response.reason_codes = [...new Set([...response.reason_codes, "deterministic_path"])];
    }

    response = scrubResponseFields(response);
    const validated = validateAnalyzeResponse(response);

    return {
      response: validated,
      meta: {
        latencyMs: Date.now() - start,
        llmUsed,
        tokens,
        evidenceVerdict: validated.evidence_verdict,
        matchedTransactionId: validated.relevant_transaction_id,
        confidence: validated.confidence,
        decision: llmUsed ? "llm_assisted" : "deterministic",
      },
    };
  }
}

module.exports = InvestigationService;
