import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import User from "../users/user.model.js";

const schema = new mongoose.Schema({
  readerId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, unique: true },
  code: { type: String, required: true, immutable: true, unique: true, match: /^[a-f0-9]{32}$/ },
}, { versionKey: false });

const Referral = mongoose.models.ReaderReferral || mongoose.model("ReaderReferral", schema);

export async function getReaderReferralCode(readerId) {
  if (!await User.exists({ _id: readerId, role: "reader", accountStatus: "active" })) return null;
  const existing = await Referral.findOne({ readerId }).lean();
  if (existing) return existing.code;
  try {
    const referral = await Referral.create({ readerId, code: randomBytes(16).toString("hex") });
    return referral.code;
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await Referral.findOne({ readerId }).lean();
    if (!existing) throw error;
    return existing.code;
  }
}

export async function resolveReaderReferral({ referralCode, buyerId, session }) {
  if (!/^[a-f0-9]{32}$/.test(referralCode)) return null;
  const referral = await Referral.findOne({ code: referralCode }).session(session ?? null).lean();
  if (!referral || String(referral.readerId) === String(buyerId)) return null;
  const active = await User.exists({ _id: referral.readerId, role: "reader", accountStatus: "active" }).session(session ?? null);
  return active ? { readerId: referral.readerId } : null;
}
