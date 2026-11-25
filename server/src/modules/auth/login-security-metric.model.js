import mongoose from "mongoose";

const loginSecurityMetricSchema = new mongoose.Schema(
  {
    bucketStart: { type: Date, required: true, immutable: true },
    expiresAt: { type: Date, required: true },
    loginSuccesses: { type: Number, required: true, default: 0, min: 0 },
    loginFailures: { type: Number, required: true, default: 0, min: 0 },
    knownAccountFailures: { type: Number, required: true, default: 0, min: 0 },
  },
  { versionKey: false },
);

loginSecurityMetricSchema.index({ bucketStart: 1 }, { unique: true });
loginSecurityMetricSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LoginSecurityMetric = mongoose.models.LoginSecurityMetric
  || mongoose.model("LoginSecurityMetric", loginSecurityMetricSchema);
export default LoginSecurityMetric;
