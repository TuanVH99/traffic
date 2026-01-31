const express = require("express");
const controller = require("./auth.controller");
const rateLimit = require("express-rate-limit");

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */

// Rate limit riêng cho login/register chống brute force
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: "test@example.com" }
 *               password: { type: string, minLength: 8, example: "12345678" }
 *               name: { type: string, example: "Test" }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         email: { type: string }
 *                         name: { type: string }
 *                         roles: { type: array, items: { type: string } }
 *                         status: { type: string }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       409:
 *         description: Email in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.post("/register", authLimiter, controller.register);
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login (sets refresh token cookie)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: "test@example.com" }
 *               password: { type: string, example: "12345678" }
 *     responses:
 *       200:
 *         description: OK
 *         headers:
 *           Set-Cookie:
 *             description: HttpOnly refreshToken cookie
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     accessToken:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.post("/login", authLimiter, controller.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token (rotates refresh cookie)
 *     security:
 *       - refreshCookie: []
 *     responses:
 *       200:
 *         description: OK
 *         headers:
 *           Set-Cookie:
 *             description: Rotated HttpOnly refreshToken cookie
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *       401:
 *         description: Invalid/expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.post("/refresh", controller.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout (revoke refresh token + clear cookie)
 *     security:
 *       - refreshCookie: []
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.post("/logout", controller.logout);


// /me yêu cầu access token
const { authRequired } = require("../../middlewares/auth.middleware");
/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user (requires access token)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.get("/me", authRequired, controller.me);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset (always returns OK; reset link is sent out-of-band)
 *     description: |
 *       For security, this endpoint always returns OK even if the email does not exist.
 *       In current implementation, the reset URL is logged to server console (can be replaced by email service later).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "test@example.com"
 *     responses:
 *       200:
 *         description: OK (always)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     ok: { type: boolean, example: true }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.post("/forgot-password", controller.forgotPassword);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using reset token
 *     description: |
 *       Resets password with a one-time reset token. Token is issued by /auth/forgot-password.
 *       After successful reset, user must login again (refresh tokens are revoked).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Reset token from reset link
 *                 example: "9f0b7f5d0e0c4c8a8a0f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c"
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: "anotherpass123"
 *     responses:
 *       200:
 *         description: OK
 *         headers:
 *           Set-Cookie:
 *             description: refreshToken cookie may be cleared
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     ok: { type: boolean, example: true }
 *       400:
 *         description: Validation error / invalid or used token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.post("/reset-password", controller.resetPassword);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (requires access token)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "12345678"
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: "newpass123"
 *     responses:
 *       200:
 *         description: OK
 *         headers:
 *           Set-Cookie:
 *             description: refreshToken cookie may be cleared (user must re-login)
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     ok: { type: boolean, example: true }
 *       400:
 *         description: Validation error / current password invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       401:
 *         description: Unauthorized (missing/invalid access token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       403:
 *         description: Account disabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.post("/change-password", authRequired, controller.changePassword);


module.exports = router;
