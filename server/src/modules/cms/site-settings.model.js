import { DEFAULT_AUTHOR_UPLOAD_LIMITS_MB, MAX_AUTHOR_UPLOAD_LIMITS_MB } from "../../../../shared/author-upload-limits.js";
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

const navigationItemSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, required: true, default: true },
    href: { type: String, required: true, trim: true, maxlength: 300 },
    label: { type: localizedTextSchema, required: true },
  },
  { _id: false },
);

const footerSchema = new mongoose.Schema(
  {
    tagline: { type: localizedTextSchema, required: true },
    browseLinks: { type: [navigationItemSchema], required: true, validate: (items) => items.length >= 1 && items.length <= 8 },
    communityTitle: { type: localizedTextSchema, required: true },
    communityLinks: { type: [navigationItemSchema], required: true, validate: (items) => items.length >= 1 && items.length <= 8 },
  },
  { _id: false },
);

const homepageSectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, match: /^(hero|trust|discovery|featured|languages|authors|community|custom-[a-z0-9-]{1,48})$/ },
    title: { type: localizedTextSchema, default: undefined },
    description: { type: localizedTextSchema, default: undefined },
    linkLabel: { type: localizedTextSchema, default: undefined },
    href: { type: String, trim: true, maxlength: 300, default: "" },
    imageUrl: { type: String, trim: true, maxlength: 60, default: "" },
    imageAlt: { type: localizedTextSchema, default: undefined },
    enabled: { type: Boolean, required: true, default: true },
  },
  { _id: false },
);

const homepageSeoSchema = new mongoose.Schema(
  {
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
  },
  { _id: false },
);

const maintenanceSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, required: true, default: false },
    message: { type: localizedTextSchema, required: true },
  },
  { _id: false },
);

const authorUploadLimitsSchema = new mongoose.Schema(
  {
    coverMaxMb: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_AUTHOR_UPLOAD_LIMITS_MB.cover,
      validate: Number.isInteger,
      default: DEFAULT_AUTHOR_UPLOAD_LIMITS_MB.cover,
    },
    manuscriptMaxMb: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_AUTHOR_UPLOAD_LIMITS_MB.manuscript,
      validate: Number.isInteger,
      default: DEFAULT_AUTHOR_UPLOAD_LIMITS_MB.manuscript,
    },
  },
  { _id: false },
);

const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true, default: "global" },
    platform: { defaultLanguage: { type: String, enum: ["en", "gu", "hi"], required: true, default: "en" }, siteName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80, default: "Rasbhav Books" }, supportEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, default: "hello@rasbhavbooks.com" } },
    uploads: { type: authorUploadLimitsSchema, required: true, default: () => ({ coverMaxMb: DEFAULT_AUTHOR_UPLOAD_LIMITS_MB.cover, manuscriptMaxMb: DEFAULT_AUTHOR_UPLOAD_LIMITS_MB.manuscript }) },
    maintenance: { type: maintenanceSchema, required: true },
    announcement: { type: announcementSchema, required: true },
    navigation: { type: [navigationItemSchema], default: [], validate: (items) => items.length <= 8 },
    footer: { type: footerSchema, required: true },
    homepage: {
      sections: { type: [homepageSectionSchema], default: [], validate: (sections) => sections.length >= 7 && sections.length <= 11 },
      featuredBookIds: { type: [{ type: String, trim: true, maxlength: 100 }], default: [], validate: (ids) => ids.length <= 4 && new Set(ids).size === ids.length },
      seo: { type: homepageSeoSchema, required: true },
      hero: { type: heroSchema, required: true },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false },
);

const SiteSettings = mongoose.models.SiteSettings || mongoose.model("SiteSettings", siteSettingsSchema);
export default SiteSettings;
