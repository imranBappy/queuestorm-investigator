const express = require("express");
const cors = require("cors");
const config = require("./config");
const requestIdMiddleware = require("./middleware/request-id");
const { createHttpLogger } = require("./middleware/logger");
const errorHandler = require("./middleware/error-handler");
const healthRoutes = require("./routes/health.routes");
const analyzeRoutes = require("./routes/analyze.routes");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(requestIdMiddleware);
  app.use(createHttpLogger());
  app.use(express.json({ limit: config.limits.maxJsonBodySize }));

  app.use(healthRoutes);
  app.use(analyzeRoutes);

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
