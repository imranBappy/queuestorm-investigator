function errorHandler(err, req, res, _next) {
  const requestId = req.requestId || "unknown";
  const logger = req.log || console;

  if (err.type === "entity.parse.failed") {
    logger.warn({ requestId, err: err.message }, "Malformed JSON body");
    return res.status(400).json({
      error: "Malformed JSON body",
      reason_codes: ["malformed_json"],
    });
  }

  if (err.statusCode) {
    logger.warn({ requestId, err: err.message, statusCode: err.statusCode }, "Request error");
    return res.status(err.statusCode).json({
      error: err.message,
      reason_codes: err.reason_codes || ["request_error"],
    });
  }

  logger.error({ requestId, err: err.message, stack: err.stack }, "Unhandled error");
  return res.status(500).json({
    error: "Internal server error",
    reason_codes: ["internal_error"],
  });
}

module.exports = errorHandler;
