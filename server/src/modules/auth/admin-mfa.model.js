import mongoose from "mongoose";

const adminMfaSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    encryptedSecret: { type: String, required: true, select: false },
    enabled: { type: Boolean, required: true, default: false },
    expiresAt: { type: Date, default: null },
    recoveryCodeHashes: { type: [{ type: String, select: false }], default: [], select: false },
  },
  { timestamps: true, versionKey: false },
);

const AdminMfa = mongoose.models.AdminMfa || mongoose.model("AdminMfa", adminMfaSchema);
export default AdminMfa;
