const express = require("express");
const { analyzeTicket } = require("../controllers/analyze.controller");
const validateAnalyzeRequestMiddleware = require("../middleware/validate-request");
const { inputSafetyMiddleware } = require("../middleware/input-safety");

const router = express.Router();

router.post(
  "/analyze-ticket",
  inputSafetyMiddleware,
  validateAnalyzeRequestMiddleware,
  analyzeTicket,
);

module.exports = router;
