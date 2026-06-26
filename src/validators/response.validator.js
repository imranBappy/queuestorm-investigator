const { analyzeResponseSchema } = require("../schemas/analyze-response.schema");

function validateAnalyzeResponse(response) {
  const result = analyzeResponseSchema.safeParse(response);

  if (!result.success) {
    const err = new Error("Response validation failed");
    err.statusCode = 500;
    err.reason_codes = ["response_validation_error"];
    err.details = result.error.issues;
    throw err;
  }

  return result.data;
}

module.exports = { validateAnalyzeResponse };
