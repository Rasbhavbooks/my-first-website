import mongoose from "mongoose";

const localizedTextSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true, maxlength: 1200, default: "" },
    gu: { type: String, required: true, trim: true, maxlength: 1200, default: "" },
    hi: { type: String, required: true, trim: true, maxlength: 1200, default: "" },
  },
  { _id: false },
);

const announcementSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, required: true, default: false },
    text: { type: localizedTextSchema, required: true },
    linkLabel: { type: localizedTextSchema, required: true },
    href: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { _id: false },
);

const heroSchema = new mongoose.Schema(
  {
    eyebrow: { type: localizedTextSchema, required: true },
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
    primaryCta: { type: localizedTextSchema, required: true },
    secondaryCta: { type: localizedTextSchema, required: true },
  },
  { _id: false },
);

const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true, default: "global" },
    announcement: { type: announcementSchema, required: true },
    homepage: {
      hero: { type: heroSchema, required: true },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false },
);

const SiteSettings = mongoose.models.SiteSettings || mongoose.model("SiteSettings", siteSettingsSchema);
export default SiteSettings;
