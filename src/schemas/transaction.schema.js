const { z } = require("zod");
const { TRANSACTION_TYPES, TRANSACTION_STATUSES } = require("../config/enums");

const transactionSchema = z
  .object({
    id: z.string().min(1).optional(),
    transaction_id: z.string().min(1).optional(),
    amount: z.number().positive(),
    currency: z.string().min(1).max(10).default("BDT"),
    type: z.enum(TRANSACTION_TYPES),
    counterparty: z.string().nullable().optional(),
    merchant: z.string().nullable().optional(),
    timestamp: z.string().min(1),
    status: z.enum(TRANSACTION_STATUSES),
  })
  .refine((data) => data.id || data.transaction_id, {
    message: "Either 'id' or 'transaction_id' is required",
    path: ["id"],
  })
  .transform((data) => {
    const id = data.id || data.transaction_id;
    return {
      ...data,
      id,
      transaction_id: id,
    };
  });

module.exports = { transactionSchema };
