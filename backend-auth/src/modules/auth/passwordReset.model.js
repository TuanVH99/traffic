const mongoose = require("mongoose");

const passwordResetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // hash của token, không lưu token plain
    tokenHash: { type: String, required: true, unique: true, index: true },

    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },

    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

// TTL: auto-delete when expiresAt passed
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PasswordResetToken", passwordResetSchema);
