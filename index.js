const config = require("./src/config");
const app = require("./src/server");
const { rootLogger } = require("./src/middleware/logger");

app.listen(config.port, () => {
  rootLogger.info({ port: config.port }, "QueueStorm Investigator API listening");
});

module.exports = app;
