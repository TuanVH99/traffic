const User = require("../users/user.model");
const RefreshToken = require("./refreshToken.model");
const { hashPassword, verifyPassword, sha256 } = require("../../utils/hash");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../../utils/jwt");
const { env } = require("../../config/env");
const { parseDurationToMs } = require("../../utils/time");
const crypto = require("crypto");
const PasswordResetToken = require("./passwordReset.model");


function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function sanitizeUser(userDoc) {
  const u = userDoc.toObject ? userDoc.toObject() : userDoc;
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    roles: u.roles,
    status: u.status,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

async function register({ email, password, name }) {
  const normalized = normalizeEmail(email);

  const existing = await User.findOne({ email: normalized }).lean();
  if (existing) {
    const err = new Error("Email already in use");
    err.statusCode = 409;
    err.code = "EMAIL_IN_USE";
    throw err;
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    email: normalized,
    passwordHash,
    name: name || "",
    roles: ["user"],
    status: "active",
  });

  return sanitizeUser(user);
}

async function login({ email, password }, meta = {}) {
  const normalized = normalizeEmail(email);

  const user = await User.findOne({ email: normalized });
  if (!user) {
    const err = new Error("Invalid credentials");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }
  if (user.status !== "active") {
    const err = new Error("Account is disabled");
    err.statusCode = 403;
    err.code = "ACCOUNT_DISABLED";
    throw err;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const err = new Error("Invalid credentials");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  const payload = { sub: String(user._id), roles: user.roles };
  const accessToken = signAccessToken(payload);

  // refresh token chỉ cần sub
  const refreshToken = signRefreshToken({ sub: payload.sub });

  // lưu refresh token hash vào DB
  const ttlMs = parseDurationToMs(env.refreshTokenTtl);
  const expiresAt = new Date(Date.now() + ttlMs);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: sha256(refreshToken),
    expiresAt,
    revokedAt: null,
    userAgent: meta.userAgent || "",
    ip: meta.ip || "",
  });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

async function refresh(refreshToken) {
  if (!refreshToken) {
    const err = new Error("Missing refresh token");
    err.statusCode = 401;
    err.code = "NO_REFRESH_TOKEN";
    throw err;
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    const err = new Error("Invalid/expired refresh token");
    err.statusCode = 401;
    err.code = "INVALID_REFRESH_TOKEN";
    throw err;
  }

  const tokenHash = sha256(refreshToken);

  const record = await RefreshToken.findOne({ tokenHash }).lean();
  if (!record || record.revokedAt) {
    const err = new Error("Refresh token revoked");
    err.statusCode = 401;
    err.code = "REFRESH_REVOKED";
    throw err;
  }

  const user = await User.findById(decoded.sub).lean();
  if (!user || user.status !== "active") {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }

  const accessToken = signAccessToken({ sub: String(user._id), roles: user.roles });
  return { accessToken };
}

async function logout(refreshToken) {
  if (!refreshToken) return;

  const tokenHash = sha256(refreshToken);
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }
  if (user.status !== "active") {
    const err = new Error("Account is disabled");
    err.statusCode = 403;
    err.code = "ACCOUNT_DISABLED";
    throw err;
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    const err = new Error("Current password is incorrect");
    err.statusCode = 400;
    err.code = "CURRENT_PASSWORD_INVALID";
    throw err;
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // best practice: sau đổi mật khẩu, revoke tất cả refresh token để bắt login lại
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });

  return true;
}

// Không leak email tồn tại hay không
async function forgotPassword(email, meta = {}) {
  const normalized = normalizeEmail(email);
  const user = await User.findOne({ email: normalized }).lean();

  // luôn trả OK
  if (!user || user.status !== "active") return { ok: true };

  // tạo token plain + hash lưu DB
  const tokenPlain = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(tokenPlain);

  const ttlMs = parseDurationToMs(env.passwordResetTtl);
  const expiresAt = new Date(Date.now() + ttlMs);

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
    usedAt: null,
    userAgent: meta.userAgent || "",
    ip: meta.ip || "",
  });

  // hiện tại: log link ra console (sau này thay bằng gửi email)
  const resetUrl = `${env.frontendResetPasswordUrl}?token=${encodeURIComponent(tokenPlain)}`;
  console.log(`[RESET_PASSWORD] user=${user.email} url=${resetUrl}`);

  return { ok: true };
}

async function resetPassword(tokenPlain, newPassword) {
  if (!tokenPlain) {
    const err = new Error("Missing reset token");
    err.statusCode = 400;
    err.code = "MISSING_RESET_TOKEN";
    throw err;
  }

  const tokenHash = sha256(tokenPlain);

  const record = await PasswordResetToken.findOne({ tokenHash });
  if (!record) {
    const err = new Error("Invalid or expired reset token");
    err.statusCode = 400;
    err.code = "RESET_TOKEN_INVALID";
    throw err;
  }
  if (record.usedAt) {
    const err = new Error("Reset token already used");
    err.statusCode = 400;
    err.code = "RESET_TOKEN_USED";
    throw err;
  }

  const user = await User.findById(record.userId);
  if (!user || user.status !== "active") {
    const err = new Error("Invalid reset token");
    err.statusCode = 400;
    err.code = "RESET_TOKEN_INVALID";
    throw err;
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // mark token used
  record.usedAt = new Date();
  await record.save();

  // revoke all refresh tokens -> buộc login lại
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });

  return true;
}


module.exports = { register, login, refresh, logout, changePassword, forgotPassword, resetPassword };
