const LlmService = require("../../src/services/llm.service");
const { buildLlmFallbackResponse } = require("../../src/utils/safe-fallback");

describe("llm.service", () => {
  test("returns fallback on timeout", async () => {
    const abortError = Object.assign(new Error("Request aborted"), { name: "AbortError" });
    const mockClient = {
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(abortError),
        },
      },
    };

    const service = new LlmService({
      client: mockClient,
      apiKey: "test-key",
      timeoutMs: 10,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });

    const result = await service.generateInvestigationContent(
      { complaint: "test", parsedComplaint: {}, transactionHistory: [] },
      { reason_codes: ["test"], case_type: "other", evidence_verdict: "insufficient_data" },
    );

    expect(result.human_review_required).toBe(true);
    expect(result.confidence).toBe(0.3);
    expect(result.reason_codes).toContain("llm_timeout");
  });

  test("parses successful LLM response", async () => {
    const mockClient = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    agent_summary: "Summary",
                    recommended_next_action: "Action",
                    customer_reply: "Reply",
                  }),
                },
              },
            ],
            usage: { total_tokens: 42 },
          }),
        },
      },
    };

    const service = new LlmService({
      client: mockClient,
      apiKey: "test-key",
      timeoutMs: 5000,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });

    const result = await service.generateInvestigationContent(
      { complaint: "test", parsedComplaint: {}, transactionHistory: [] },
      { agent_summary: "old", reason_codes: [] },
    );

    expect(result.agent_summary).toBe("Summary");
    expect(result.llmUsed).toBe(true);
    expect(result.tokens).toBe(42);
  });
});

describe("safe-fallback", () => {
  test("builds fallback response", () => {
    const result = buildLlmFallbackResponse({ case_type: "other" });
    expect(result.human_review_required).toBe(true);
    expect(result.confidence).toBe(0.3);
    expect(result.reason_codes).toContain("llm_timeout");
  });
});
