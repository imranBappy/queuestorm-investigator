const { parseComplaint } = require("../../src/services/investigation/complaint-parser");
const { detectLanguage } = require("../../src/utils/language-detect");

describe("language-detect", () => {
  test("detects English", () => {
    expect(detectLanguage("I sent money to wrong number").language).toBe("en");
  });

  test("detects Bangla script", () => {
    expect(detectLanguage("আমি ভুল নম্বরে টাকা পাঠিয়েছি").language).toBe("bn");
  });

  test("detects banglish", () => {
    expect(detectLanguage("ami 5000 taka pathiyechi wrong number e").language).toBe(
      "banglish",
    );
  });
});

describe("complaint-parser", () => {
  test("extracts amount, type, time, and intent", () => {
    const result = parseComplaint("I sent 5000 taka around 2pm to wrong number");

    expect(result.amount).toBe(5000);
    expect(result.transactionType).toBe("transfer");
    expect(result.time).toBe("2pm");
    expect(result.intent).toBe("wrong_transfer");
    expect(result.language).toBe("en");
  });

  test("extracts phone numbers", () => {
    const result = parseComplaint("Transferred to 01712345678");
    expect(result.phoneNumbers.length).toBeGreaterThan(0);
  });

  test("detects payment failed intent", () => {
    const result = parseComplaint("My payment failed but money was deducted");
    expect(result.intent).toBe("payment_failed");
  });

  test("detects refund request", () => {
    const result = parseComplaint("I need a refund for duplicate charge");
    expect(result.intent).toBe("refund_request");
  });

  test("detects phishing intent", () => {
    const result = parseComplaint("Someone called asking for my OTP, possible scam");
    expect(result.intent).toBe("phishing_or_social_engineering");
  });
});
