const { detectLanguage } = require("../../utils/language-detect");

const BANGLA_TO_ASCII = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

const AMOUNT_PATTERNS = [
  /(?:৳|tk\.?|taka|টাকা)\s*([\d,০-৯]+(?:\.\d+)?)/i,
  /([\d,০-৯]+(?:\.\d+)?)\s*(?:taka|tk\.?|bdt|টাকা)/i,
  /\b([\d,০-৯]+(?:\.\d+)?)\b/,
];

const PHONE_PATTERNS = [
  /\+8801[3-9]\d{8}/g,
  /01[3-9]\d{8}/g,
  /8801[3-9]\d{8}/g,
];

const TIME_PATTERNS = [
  /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i,
  /\b(\d{1,2}\s*(?:am|pm))\b/i,
  /\b(yesterday|today|last\s+night|this\s+morning)\b/i,
];

const MERCHANT_PATTERN = /\b(?:at|from|to)\s+([A-Za-z][A-Za-z0-9\s&'.-]{2,40})\b/i;

const TYPE_KEYWORDS = {
  transfer: /\b(transfer|sent|send|pathano|pathiyechi|money\s+sent|পাঠি)/i,
  payment: /\b(payment|paid|pay|bill|charge|deduct)\b/i,
  refund: /\b(refund|money\s+back|return\s+money)\b/i,
  withdrawal: /\b(withdraw|withdrawal|cash\s+out)\b/i,
  cash_in: /(?:cash\s*in|cash-in|cashin|ক্যাশ\s*ইন)/i,
  settlement: /\b(settle|settlement)\b/i,
};

const INTENT_KEYWORDS = {
  agent_cash_in_issue: /(?:cash\s*in|cash-in|cashin|ক্যাশ\s*ইন)/i,
  wrong_transfer:
    /\b(wrong\s+(?:number|account|person|transfer)|sent\s+to\s+wrong|mistake\s+transfer|bhul\s+(?:number|transfer)|sent\b[^.]{0,100}\bdidn'?t\s+(?:get|receive)\b|not\s+received)\b/i,
  payment_failed:
    /\b(payment\s+failed|failed\s+payment|payment.*failed|did\s+not\s+go\s+through|transaction\s+failed|hoyni|failed)\b/i,
  refund_request: /\b(refund|money\s+back|return\s+my\s+money|chargeback)\b/i,
  phishing_or_social_engineering:
    /\b(phishing|scam|fraud|fake\s+call|otp\s+share|password\s+share|suspicious\s+link|hacked|asked\s+for\s+(?:my\s+)?(?:otp|pin|password)|account\s+will\s+be\s+blocked|called\s+me\s+(?:saying|claiming))\b/i,
  duplicate_payment:
    /\b(twice|double|duplicate|two\s+times|twice\s+deducted|deducted\s+twice|charged\s+twice|paid\s+twice)\b/i,
  merchant_settlement_delay:
    /\b(settle|settlement|sales|not\s+settled|merchant\s+sales|settlement\s+delay)\b/i,
};

function normalizeBanglaDigits(text) {
  return text.replace(/[০-৯]/g, (ch) => BANGLA_TO_ASCII[ch] ?? ch);
}

function parseAmount(text) {
  const normalized = normalizeBanglaDigits(text);
  for (const pattern of AMOUNT_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      const raw = match[1].replace(/,/g, "");
      const value = parseFloat(raw);
      if (!Number.isNaN(value) && value > 0) {
        return value;
      }
    }
  }
  return null;
}

function parsePhoneNumbers(text) {
  const phones = new Set();
  for (const pattern of PHONE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((m) => phones.add(m.replace(/\s/g, "")));
    }
  }
  return [...phones];
}

function parseTime(text) {
  for (const pattern of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  return null;
}

function parseMerchant(text) {
  const match = text.match(MERCHANT_PATTERN);
  return match ? match[1].trim() : null;
}

function parseTransactionType(text) {
  for (const [type, pattern] of Object.entries(TYPE_KEYWORDS)) {
    if (pattern.test(text)) {
      return type;
    }
  }
  return null;
}

function parseIntent(text) {
  for (const [intent, pattern] of Object.entries(INTENT_KEYWORDS)) {
    if (pattern.test(text)) {
      return intent;
    }
  }
  return "other";
}

function calculateParserConfidence(parsed) {
  let score = 0.3;
  if (parsed.amount !== null) score += 0.2;
  if (parsed.transactionType) score += 0.15;
  if (parsed.intent !== "other") score += 0.2;
  if (parsed.phoneNumbers.length > 0) score += 0.1;
  if (parsed.time) score += 0.05;
  return Math.min(score, 0.95);
}

function parseComplaint(complaint) {
  const text = complaint.trim();
  const { language, confidence: languageConfidence } = detectLanguage(text);

  const parsed = {
    rawText: text,
    amount: parseAmount(text),
    transactionType: parseTransactionType(text),
    phoneNumbers: parsePhoneNumbers(text),
    merchant: parseMerchant(text),
    time: parseTime(text),
    intent: parseIntent(text),
    language,
    languageConfidence,
  };

  parsed.parserConfidence = calculateParserConfidence(parsed);
  return parsed;
}

module.exports = { parseComplaint };
