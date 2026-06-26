if (process.env.NODE_ENV !== "test") {
  require("dotenv").config();
}

const config = {
  port: Number(process.env.PORT) || 5001,
  openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
  llm: {
    model: process.env.LLM_MODEL || "openai/gpt-4o-mini",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 10000,
    temperature: 0,
  },
  matcher: {
    scoreThreshold: 50,
    amountTolerancePercent: 1,
    timeWindowHours: 2,
  },
  limits: {
    maxComplaintLength: 10000,
    maxTransactionHistory: 500,
    maxJsonBodySize: "1mb",
  },
  logLevel: process.env.LOG_LEVEL || "info",
};

module.exports = config;
