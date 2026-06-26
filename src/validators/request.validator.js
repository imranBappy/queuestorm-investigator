const { analyzeRequestSchema } = require("../schemas/analyze-request.schema");

function validateAnalyzeRequest(body) {
  const result = analyzeRequestSchema.safeParse(body);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    const err = new Error("Request validation failed");
    err.statusCode = 400;
    err.reason_codes = ["validation_error"];
    err.details = issues;
    throw err;
  }

  return result.data;
}

module.exports = { validateAnalyzeRequest };
