const mongoose = require("mongoose");

const { Schema } = mongoose;

const verificationCodeSchema = new Schema(
  {
    email: { type: String, required: true },
    doctorKind: String,
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }, // Custom expiration field
  },
  { timestamps: true }
);

// Add TTL index for `expiresAt`. It handles both default and custom expiration.
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  "VerificationCode",
  verificationCodeSchema,
  "verificationCodes"
);
