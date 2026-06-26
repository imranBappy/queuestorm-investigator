const config = require("../../config");
const {
  normalizePhone,
  amountsMatch,
  parseTimestamp,
  hoursDifference,
} = require("../../utils/score");

function scoreTransaction(parsedComplaint, transaction) {
  let score = 0;
  const reasonCodes = [];

  if (
    parsedComplaint.amount !== null &&
    amountsMatch(parsedComplaint.amount, transaction.amount, config.matcher.amountTolerancePercent)
  ) {
    score += 40;
    reasonCodes.push("amount_match");
  }

  if (
    parsedComplaint.transactionType &&
    parsedComplaint.transactionType === transaction.type
  ) {
    score += 20;
    reasonCodes.push("type_match");
  }

  const complaintPhones = parsedComplaint.phoneNumbers.map(normalizePhone);
  const counterparty = normalizePhone(transaction.counterparty);
  if (complaintPhones.length > 0 && counterparty) {
    const phoneMatch = complaintPhones.some(
      (p) => p === counterparty || counterparty.endsWith(p) || p.endsWith(counterparty),
    );
    if (phoneMatch) {
      score += 25;
      reasonCodes.push("counterparty_match");
    }
  }

  if (parsedComplaint.merchant && transaction.merchant) {
    if (
      transaction.merchant.toLowerCase().includes(parsedComplaint.merchant.toLowerCase())
    ) {
      score += 10;
      reasonCodes.push("merchant_match");
    }
  }

  const complaintTime = parseTimestamp(parsedComplaint.time);
  const txnTime = parseTimestamp(transaction.timestamp);
  if (complaintTime && txnTime) {
    const diff = hoursDifference(complaintTime, txnTime);
    if (diff !== null && diff <= config.matcher.timeWindowHours) {
      score += 10;
      reasonCodes.push("time_proximity");
    }
  } else if (txnTime && parsedComplaint.time) {
    score += 5;
    reasonCodes.push("time_reference");
  }

  if (transaction.status) {
    score += 5;
    reasonCodes.push("status_considered");
  }

  return { score, reasonCodes, transaction };
}

const AMBIGUOUS_SCORE_DELTA = 5;

function pickDuplicatePaymentMatch(parsedComplaint, scored, threshold) {
  const candidates = scored.filter(
    (entry) =>
      entry.score >= threshold &&
      parsedComplaint.amount !== null &&
      amountsMatch(
        parsedComplaint.amount,
        entry.transaction.amount,
        config.matcher.amountTolerancePercent,
      ) &&
      entry.transaction.status === "completed",
  );

  if (candidates.length < 2) {
    return null;
  }

  const latest = [...candidates].sort(
    (a, b) => parseTimestamp(b.transaction.timestamp) - parseTimestamp(a.transaction.timestamp),
  )[0];

  return {
    relevantTransactionId: latest.transaction.id,
    matchedTransaction: latest.transaction,
    matchScore: latest.score,
    reasonCodes: [...latest.reasonCodes, "duplicate_payment_match"],
    ambiguous: false,
  };
}

function isAmbiguousMatch(parsedComplaint, scored, best, threshold) {
  if (parsedComplaint.phoneNumbers.length > 0) {
    return false;
  }

  const topTier = scored.filter(
    (entry) =>
      entry.score >= threshold && best.score - entry.score <= AMBIGUOUS_SCORE_DELTA,
  );

  if (topTier.length <= 1) {
    return false;
  }

  const sameAmount = topTier.every(
    (entry) => entry.transaction.amount === topTier[0].transaction.amount,
  );

  return sameAmount;
}

function matchTransaction(parsedComplaint, transactionHistory) {
  if (!transactionHistory || transactionHistory.length === 0) {
    return {
      relevantTransactionId: null,
      matchedTransaction: null,
      matchScore: 0,
      ambiguous: false,
      reasonCodes: ["no_transaction_history"],
    };
  }

  const scored = transactionHistory
    .map((txn) => scoreTransaction(parsedComplaint, txn))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const threshold = config.matcher.scoreThreshold;

  if (!best || best.score < threshold) {
    return {
      relevantTransactionId: null,
      matchedTransaction: null,
      matchScore: best?.score || 0,
      ambiguous: false,
      reasonCodes: ["no_confident_match"],
    };
  }

  if (parsedComplaint.intent === "duplicate_payment") {
    const duplicateMatch = pickDuplicatePaymentMatch(parsedComplaint, scored, threshold);
    if (duplicateMatch) {
      return duplicateMatch;
    }
  }

  if (isAmbiguousMatch(parsedComplaint, scored, best, threshold)) {
    return {
      relevantTransactionId: null,
      matchedTransaction: null,
      matchScore: best.score,
      ambiguous: true,
      reasonCodes: ["ambiguous_match", "needs_clarification"],
    };
  }

  return {
    relevantTransactionId: best.transaction.id,
    matchedTransaction: best.transaction,
    matchScore: best.score,
    ambiguous: false,
    reasonCodes: best.reasonCodes,
  };
}

module.exports = { matchTransaction, scoreTransaction };
