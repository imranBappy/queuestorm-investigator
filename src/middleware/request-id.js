const { randomUUID } = require("crypto");

function requestIdMiddleware(req, res, next) {
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

module.exports = requestIdMiddleware;
