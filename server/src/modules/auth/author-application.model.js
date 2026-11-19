import mongoose from "mongoose";

const authorApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    authorName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    biography: { type: String, required: true, trim: true, minlength: 40, maxlength: 2000 },
    writingLanguages: {
      type: [{ type: String, enum: ["Gujarati", "Hindi", "English"] }],
      required: true,
      validate: [(values) => values.length > 0 && values.length <= 3, "Select one to three writing languages."],
    },
    genres: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
      validate: [(values) => values.length <= 10, "Choose no more than 10 genres."],
    },
    writingSampleUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
      validate(value) {
        if (!value) return true;
        try { return new URL(value).protocol === "https:"; } catch { return false; }
      },
    },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    adminNote: { type: String, trim: true, maxlength: 800, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

authorApplicationSchema.index({ status: 1, createdAt: 1 });

const AuthorApplication = mongoose.models.AuthorApplication || mongoose.model("AuthorApplication", authorApplicationSchema);
export default AuthorApplication;
