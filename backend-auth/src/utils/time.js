
function parseDurationToMs(str) {
  // hỗ trợ: 15m, 10s, 2h, 7d
  const m = String(str).trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) throw new Error(`Invalid duration format: ${str} (use 15m/2h/7d)`);
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return value * mult;
}

module.exports = { parseDurationToMs };
