const bcrypt = require("bcrypt");
const crypto = require("crypto");

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

module.exports = { hashPassword, verifyPassword, sha256 };
