const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("./auth.schema");
const authService = require("./auth.service");
const { env } = require("../../config/env");
const { authRequired } = require("../../middlewares/auth.middleware");
const User = require("../users/user.model");

function setRefreshCookie(res, refreshToken) {
  // Dev: Secure=false; Prod: Secure=true (https)
  const isProd = env.nodeEnv === "production";

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/auth", // cookie chỉ gửi cho /auth/*
    // maxAge: tuỳ chọn (ms). Không set cũng ok vì JWT có exp.
  });
}

async function register(req, res, next) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const user = await authService.register(parsed.data);
    res.status(201).json({ data: { user } });
  } catch (e) {
    next(e);
  }
}

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { user, accessToken, refreshToken } = await authService.login(parsed.data, {
      userAgent: req.headers["user-agent"] || "",
      ip: req.ip,
    }); setRefreshCookie(res, refreshToken);

    res.json({ data: { user, accessToken } });
  } catch (e) {
    next(e);
  }
}

async function me(req, res, next) {
  try {
    // authRequired đã set req.auth = { sub, roles }
    const user = await User.findById(req.auth.sub).lean();
    if (!user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    }

    res.json({
      data: {
        user: {
          id: String(user._id),
          email: user.email,
          name: user.name,
          roles: user.roles,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (e) {
    next(e);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies.refreshToken;
    const { accessToken } = await authService.refresh(token);
    res.json({ data: { accessToken } });
  } catch (e) {
    next(e);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies.refreshToken;
    await authService.logout(token);

    const isProd = env.nodeEnv === "production";
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/auth",
    });

    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
}

async function changePassword(req, res, next) {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    await authService.changePassword(req.auth.sub, parsed.data);

    // clear refresh cookie vì đã revoke all refresh token
    const isProd = env.nodeEnv === "production";
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/auth",
    });

    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    await authService.forgotPassword(parsed.data.email, {
      userAgent: req.headers["user-agent"] || "",
      ip: req.ip,
    });

    // luôn trả OK
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
}

async function resetPassword(req, res, next) {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    await authService.resetPassword(parsed.data.token, parsed.data.newPassword);

    // xoá refresh cookie để tránh dùng session cũ
    const isProd = env.nodeEnv === "production";
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/auth",
    });

    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
}


module.exports = { register, login, me, refresh, logout, changePassword, forgotPassword, resetPassword };
