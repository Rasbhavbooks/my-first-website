import mongoose from "mongoose";

const readerSessionSchema = new mongoose.Schema(
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

const ReaderSession = mongoose.models.ReaderSession || mongoose.model("ReaderSession", readerSessionSchema);
export default ReaderSession;
