const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Accepts "2013-08-12", "2013-08-12T09:28:22", or a Date; uses the wall-clock values as written.
function parse(v) {
  if (v instanceof Date) return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, d: v.getUTCDate(), H: v.getUTCHours(), M: v.getUTCMinutes(), has: true };
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3], H: m[4] ? +m[4] : 0, M: m[5] ? +m[5] : 0, has: !!m[4] };
}

function sortKey(v) {
  const p = parse(v);
  return p ? p.y * 1e8 + p.m * 1e6 + p.d * 1e4 + p.H * 100 + p.M : 0;
}

function formatDate(v) {
  const p = parse(v);
  return p ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : "";
}

function formatTime(v) {
  const p = parse(v);
  if (!p || !p.has) return "";
  const h12 = p.H % 12 === 0 ? 12 : p.H % 12;
  return `${h12}:${String(p.M).padStart(2, "0")}${p.H < 12 ? "am" : "pm"}`;
}

module.exports = { parse, sortKey, formatDate, formatTime };
