import mongoose from "mongoose";

const verificationTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true, versionKey: false },
);

const VerificationToken = mongoose.models.VerificationToken
  || mongoose.model("VerificationToken", verificationTokenSchema);
export default VerificationToken;
