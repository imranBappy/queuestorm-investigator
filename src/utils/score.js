function normalizePhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits.slice(3);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function amountsMatch(a, b, tolerancePercent = 1) {
  if (a == null || b == null) return false;
  const tolerance = (a * tolerancePercent) / 100;
  return Math.abs(a - b) <= tolerance;
}

function parseTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursDifference(a, b) {
  if (!a || !b) return null;
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

module.exports = {
  normalizePhone,
  amountsMatch,
  parseTimestamp,
  hoursDifference,
};
