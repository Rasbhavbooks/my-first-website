import mongoose from "mongoose";

const authorProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 140 },
    authorName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    biography: { type: String, required: true, trim: true, minlength: 40, maxlength: 2000 },
    writingLanguages: {
      type: [{ type: String, enum: ["Gujarati", "Hindi", "English"] }],
      required: true,
      validate: [(values) => values.length > 0 && values.length <= 3, "Select one to three writing languages."],
    },
    genres: { type: [{ type: String, trim: true, maxlength: 40 }], default: [], validate: [(values) => values.length <= 10, "Choose no more than 10 genres."] },
    writingSampleUrl: { type: String, trim: true, maxlength: 500, default: "" },
    websiteUrl: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
  },
  { timestamps: true, versionKey: false },
);

authorProfileSchema.index({ authorName: 1 });

const AuthorProfile = mongoose.models.AuthorProfile || mongoose.model("AuthorProfile", authorProfileSchema);
export default AuthorProfile;
