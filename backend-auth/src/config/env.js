require("dotenv").config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8080),

  mongoUri: process.env.MONGO_URI,

  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "30d",
  passwordResetTtl: process.env.PASSWORD_RESET_TTL || "15m",
  frontendResetPasswordUrl: process.env.FRONTEND_RESET_PASSWORD_URL || "http://localhost:3000/reset-password",

};

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env: ${name}`);
}

function validateEnv() {
  requireEnv("MONGO_URI", env.mongoUri);
  requireEnv("JWT_ACCESS_SECRET", env.jwtAccessSecret);
  requireEnv("JWT_REFRESH_SECRET", env.jwtRefreshSecret);
}

module.exports = { env, validateEnv };
