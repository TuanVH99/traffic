const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { env } = require("./config/env");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

function createApp() {
  const app = express();



  // Security headers
  app.use(helmet());

  // JSON body
  app.use(express.json({ limit: "1mb" }));

  // Cookies (dùng cho refresh token)
  app.use(cookieParser());

  // CORS (bật credentials để dùng cookie refresh)
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );

  // Basic rate limit (áp toàn app; sau này sẽ thêm limit riêng cho login)
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Healthcheck
  app.get("/health", (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  // TODO: auth routes sẽ gắn ở đây:
  // app.use("/auth", authRoutes)

  const authRoutes = require("./modules/auth/auth.routes");
  app.use("/auth", authRoutes);

  const swaggerUi = require("swagger-ui-express");
  const { swaggerSpec } = require("./config/swagger");
  app.get("/openapi.json", (req, res) => res.json(swaggerSpec));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));



  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
