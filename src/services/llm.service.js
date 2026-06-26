const OpenAI = require("openai");
const config = require("../config");
const { buildInvestigatorSystemPrompt } = require("../prompts/investigator.system");
const { buildLlmFallbackResponse } = require("../utils/safe-fallback");
const { rootLogger } = require("../middleware/logger");

class LlmService {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? config.openrouterApiKey;
    this.logger = options.logger || rootLogger;
    this.timeoutMs = options.timeoutMs || config.llm.timeoutMs;
    this.model = options.model || config.llm.model;
    this.client = options.client || null;
    if (!this.client && this.hasApiKey()) {
      this.client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: this.apiKey,
      });
    }
  }

  hasApiKey() {
    return Boolean(this.apiKey);
  }

  async generateInvestigationContent(context, partialResponse) {
    if (!this.hasApiKey()) {
      this.logger.warn("OPENROUTER_API_KEY not configured, using fallback");
      return {
        ...buildLlmFallbackResponse(partialResponse),
        reason_codes: [
          ...new Set([...(partialResponse.reason_codes || []), "llm_not_configured"]),
        ],
      };
    }

    if (!this.client) {
      this.logger.warn("LLM client unavailable, using fallback");
      return {
        ...buildLlmFallbackResponse(partialResponse),
        reason_codes: [
          ...new Set([...(partialResponse.reason_codes || []), "llm_not_configured"]),
        ],
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const result = await this.client.chat.completions.create(
        {
          model: this.model,
          temperature: config.llm.temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: buildInvestigatorSystemPrompt() },
            {
              role: "user",
              content: JSON.stringify({
                complaint: context.complaint,
                parsed_complaint: context.parsedComplaint,
                transaction_history: context.transactionHistory,
                investigation_state: partialResponse,
              }),
            },
          ],
        },
        { signal: controller.signal },
      );

      clearTimeout(timeout);

      const content = result?.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);

      this.logger.info({
        model: this.model,
        tokens: result.usage?.total_tokens,
        decision: "llm_success",
      });

      return {
        agent_summary: parsed.agent_summary || partialResponse.agent_summary,
        recommended_next_action:
          parsed.recommended_next_action || partialResponse.recommended_next_action,
        customer_reply: parsed.customer_reply || partialResponse.customer_reply,
        llmUsed: true,
        tokens: result.usage?.total_tokens,
      };
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout =
        err.name === "AbortError" ||
        err.name === "APIUserAbortError" ||
        err.code === "ABORT_ERR";
      this.logger.error({
        err: err.message,
        decision: isTimeout ? "llm_timeout" : "llm_error",
      });

      return buildLlmFallbackResponse({
        ...partialResponse,
        reason_codes: [
          ...new Set([
            ...(partialResponse.reason_codes || []),
            isTimeout ? "llm_timeout" : "llm_error",
          ]),
        ],
      });
    }
  }
}

module.exports = LlmService;
