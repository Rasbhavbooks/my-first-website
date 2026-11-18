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
      enum: ["pending_verification", "active", "suspended"],
      default: "pending_verification",
      required: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_document, result) {
        delete result.passwordHash;
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
