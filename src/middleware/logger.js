const pino = require("pino");
const pinoHttp = require("pino-http");
const config = require("../config");

const rootLogger = pino({
  level: config.logLevel,
  redact: {
    paths: ["req.headers.authorization", "OPENROUTER_API_KEY"],
    remove: true,
  },
});

function createHttpLogger() {
  return pinoHttp({
    logger: rootLogger,
    genReqId: (req) => req.requestId,
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} completed with ${res.statusCode}`,
    customErrorMessage: (req, res) =>
      `${req.method} ${req.url} failed with ${res.statusCode}`,
    customProps: (req) => ({
      requestId: req.requestId,
    }),
  });
}

module.exports = { rootLogger, createHttpLogger };
