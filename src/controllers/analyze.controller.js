const InvestigationService = require("../services/investigation/investigation.service");

const investigationService = new InvestigationService();

async function analyzeTicket(req, res, next) {
  const start = Date.now();

  try {
    const { ticket_id, complaint, transaction_history } = req.validatedBody;
    const { response, meta } = await investigationService.investigate({
      ticket_id,
      complaint,
      transaction_history,
    });

    req.log?.info({
      requestId: req.requestId,
      latencyMs: meta.latencyMs,
      totalLatencyMs: Date.now() - start,
      evidenceVerdict: meta.evidenceVerdict,
      matchedTransactionId: meta.matchedTransactionId,
      confidence: meta.confidence,
      llmUsed: meta.llmUsed,
      tokens: meta.tokens,
      decision: meta.decision,
    });

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

module.exports = { analyzeTicket };
