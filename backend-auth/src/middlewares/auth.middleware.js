const { verifyAccessToken } = require("../utils/jwt");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing access token" } });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.auth = { sub: decoded.sub, roles: decoded.roles || [] };
    return next();
  } catch (e) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid/expired access token" } });
  }
}

module.exports = { authRequired };
