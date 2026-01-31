function notFound(req, res) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;

  // Tránh lộ stack trong production
  const payload = {
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "Internal Server Error",
    },
  };

  if (process.env.NODE_ENV !== "production") {
    payload.error.stack = err.stack;
  }

  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
