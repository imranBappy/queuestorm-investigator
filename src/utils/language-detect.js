const BANGLA_SCRIPT = /[\u0980-\u09FF]/;
const BANGLA_TOKENS =
  /\b(ami|pathiyechi|pathano|bhul|somossa|korechi|diyechi|kena|niye|hoyeche|hoyni)\b/i;

function detectLanguage(text) {
  if (!text || typeof text !== "string") {
    return { language: "en", confidence: 0.5 };
  }

  const hasBanglaScript = BANGLA_SCRIPT.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  const hasBanglaTokens = BANGLA_TOKENS.test(text);

  if (hasBanglaScript && hasLatin) {
    return { language: "mixed", confidence: 0.9 };
  }

  if (hasBanglaScript) {
    return { language: "bn", confidence: 0.95 };
  }

  if (hasBanglaTokens && hasLatin) {
    return { language: "banglish", confidence: 0.85 };
  }

  return { language: "en", confidence: 0.9 };
}

module.exports = { detectLanguage };
