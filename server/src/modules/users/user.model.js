import argon2 from "argon2";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 280,
      default: "",
    },
    hobbies: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
      validate: {
        validator: (items) => items.length <= 10,
        message: "A reader can save up to 10 hobbies.",
      },
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
      validate: {
        validator(value) {
          if (!value) return true;
          try {
            return new URL(value).protocol === "https:";
          } catch {
            return false;
          }
        },
        message: "Profile photo URL must use HTTPS.",
      },
    },
    avatarAssetKey: { type: String, select: false },
    avatarAssetContentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], select: false },
    avatarAssetSize: { type: Number, min: 1, max: 5 * 1024 * 1024, select: false },
    avatarUploadedAt: { type: Date, select: false },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["reader", "author", "admin"],
      default: "reader",
      required: true,
    },
    accountStatus: {
      type: String,
      enum: ["pending_verification", "active", "suspended", "deleted"],
      default: "pending_verification",
      required: true,
    },
    monthlyReadingReminder: { type: Boolean, default: false },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    adminMfaEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_document, result) {
        delete result.passwordHash;
        delete result.avatarAssetKey;
        delete result.avatarAssetContentType;
        delete result.avatarAssetSize;
        delete result.avatarUploadedAt;
        return result;
      },
    },
  },
);

userSchema.methods.setPassword = async function setPassword(plainTextPassword) {
  this.passwordHash = await argon2.hash(plainTextPassword, {
    type: argon2.argon2id,
  });
};

userSchema.methods.verifyPassword = async function verifyPassword(plainTextPassword) {
  if (!this.passwordHash) return false;
  return argon2.verify(this.passwordHash, plainTextPassword);
};

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
