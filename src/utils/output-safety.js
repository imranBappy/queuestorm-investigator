const UNSAFE_OUTPUT_PATTERNS = [
  { pattern: /\bPIN\b/gi, replacement: "[redacted]" },
  { pattern: /\bOTP\b/gi, replacement: "[redacted]" },
  { pattern: /\bpassword\b/gi, replacement: "[redacted]" },
  { pattern: /\bpasscode\b/gi, replacement: "[redacted]" },
  { pattern: /\bcredentials?\b/gi, replacement: "[redacted]" },
  { pattern: /\bcvv\b/gi, replacement: "[redacted]" },
  { pattern: /\bcard\s*number\b/gi, replacement: "[redacted]" },
  { pattern: /\bapi\s*key\b/gi, replacement: "[redacted]" },
  { pattern: /\btoken\b/gi, replacement: "[redacted]" },
  { pattern: /\bsecret\b/gi, replacement: "[redacted]" },
  {
    pattern: /\b(i|we)\s+(have|will|already)?\s*refund(ed)?\b/gi,
    replacement: "We are reviewing your refund request",
  },
  {
    pattern: /\brefund\s+(is|has\s+been|will\s+be|was)\s*(processed|approved|issued|done)\b/gi,
    replacement: "We are reviewing your refund request",
  },
  {
    pattern: /\b(i|we)\s+(have|will|already)?\s*reverse(d)?\b/gi,
    replacement: "We are reviewing the transaction status",
  },
  {
    pattern: /\breversal\s+(has\s+been|will\s+be|is|was)\s*(initiated|processed|done)\b/gi,
    replacement: "We are reviewing the transaction status",
  },
  {
    pattern: /\b(i|we)\s+(have|will|already)?\s*unblock(ed)?\b/gi,
    replacement: "We are reviewing your account status",
  },
  {
    pattern: /\baccount\s+(has\s+been|is|will\s+be|was)\s+unblocked\b/gi,
    replacement: "We are reviewing your account status",
  },
  {
    pattern: /\b(i|we)\s+(have|will|already)?\s*recover(ed)?\b/gi,
    replacement: "We are investigating the transaction activity",
  },
  {
    pattern: /\b(money|funds|balance)\s+(has\s+been|is|will\s+be|was)\s+recovered\b/gi,
    replacement: "We are investigating the transaction activity",
  },
  { pattern: /at\s+\S+\s+line\s+\d+/gi, replacement: "[error details removed]" },
  { pattern: /Error:\s*.+/gi, replacement: "[error details removed]" },
];

function scrubUnsafeOutput(text) {
  if (!text || typeof text !== "string") {
    return { text: text || "", flagged: false };
  }

  let scrubbed = text;
  let flagged = false;

  for (const { pattern, replacement } of UNSAFE_OUTPUT_PATTERNS) {
    if (pattern.test(scrubbed)) {
      flagged = true;
      scrubbed = scrubbed.replace(pattern, replacement);
    }
  }

  return { text: scrubbed, flagged };
}

function scrubResponseFields(response) {
  const fields = ["agent_summary", "recommended_next_action", "customer_reply"];
  let flagged = false;
  const result = { ...response };

  for (const field of fields) {
    if (result[field]) {
      const { text, flagged: fieldFlagged } = scrubUnsafeOutput(result[field]);
      result[field] = text;
      if (fieldFlagged) flagged = true;
    }
  }

  if (flagged) {
    result.human_review_required = true;
    result.reason_codes = [...new Set([...result.reason_codes, "output_safety_scrub"])];
    result.confidence = Math.min(result.confidence, 0.5);
  }

  return result;
}

module.exports = { scrubUnsafeOutput, scrubResponseFields };
