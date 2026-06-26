const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /reveal\s+(the\s+)?(system\s+)?prompt/i,
  /show\s+(me\s+)?(your\s+)?(api\s+)?key/i,
  /disregard\s+(all\s+)?prior\s+instructions/i,
  /you\s+are\s+now\s+/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /SELECT\s+\*\s+FROM/i,
  /DROP\s+TABLE/i,
  /UNION\s+SELECT/i,
  /--\s*$/m,
  /;\s*DELETE\s+FROM/i,
];

function detectInjection(text) {
  if (!text || typeof text !== "string") {
    return { blocked: false, matchedPattern: null };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, matchedPattern: pattern.toString() };
    }
  }

  return { blocked: false, matchedPattern: null };
}

function inputSafetyMiddleware(req, res, next) {
  const complaint = req.body?.complaint;
  const check = detectInjection(complaint);

  if (check.blocked) {
    req.log?.warn({ requestId: req.requestId, pattern: check.matchedPattern }, "Input safety block");
    return res.status(403).json({
      error: "Request blocked by input safety policy",
      reason_codes: ["prompt_injection_detected"],
    });
  }

  next();
}

module.exports = { detectInjection, inputSafetyMiddleware };
