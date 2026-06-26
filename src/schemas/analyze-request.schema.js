const { z } = require("zod");
const config = require("../config");
const { transactionSchema } = require("./transaction.schema");

const analyzeRequestSchema = z.object({
  ticket_id: z.string().min(1, "Ticket ID cannot be empty"),
  complaint: z
    .string()
    .min(1, "Complaint cannot be empty")
    .max(config.limits.maxComplaintLength, "Complaint exceeds maximum length"),
  transaction_history: z
    .array(transactionSchema)
    .max(config.limits.maxTransactionHistory)
    .default([]),
  language: z.string().optional(),
  channel: z.string().optional(),
  user_type: z.string().optional(),
  campaign_context: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

module.exports = { analyzeRequestSchema };
