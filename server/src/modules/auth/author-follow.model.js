import mongoose from "mongoose";

const authorFollowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    authorProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "AuthorProfile", default: null, index: true },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
  },
  { timestamps: true, versionKey: false },
);

authorFollowSchema.index({ userId: 1, authorKey: 1 }, { unique: true });
authorFollowSchema.index({ authorKey: 1 });

const AuthorFollow = mongoose.models.AuthorFollow || mongoose.model("AuthorFollow", authorFollowSchema);
export default AuthorFollow;
