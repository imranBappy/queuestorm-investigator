const { validateAnalyzeRequest } = require("../validators/request.validator");

function validateAnalyzeRequestMiddleware(req, res, next) {
  try {
    req.validatedBody = validateAnalyzeRequest(req.body);
    next();
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({
        error: err.message,
        reason_codes: err.reason_codes || ["validation_error"],
        details: err.details || [],
      });
    }
    next(err);
  }
}

module.exports = validateAnalyzeRequestMiddleware;
