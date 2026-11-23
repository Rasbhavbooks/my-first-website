import mongoose from "mongoose";
import { env } from "../../config/env.js";
import AdminMfa from "./admin-mfa.model.js";
import { createAdminMfaEnrollment, decryptAdminMfaSecret, generateRecoveryCodes, hashRecoveryCode, verifyAdminMfaCode } from "./admin-mfa.service.js";
import User from "../users/user.model.js";

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

export async function getAdminMfaStatus(request, response) {
  const record = await AdminMfa.findOne({ userId: request.reader._id })
    .select("enabled +recoveryCodeHashes")
    .lean();
  response.setHeader("Cache-Control", "no-store");
  return response.json({
    data: {
      enabled: Boolean(request.reader.adminMfaEnabled && record?.enabled),
      recoveryCodesRemaining: record?.enabled ? record.recoveryCodeHashes?.length || 0 : 0,
      setupAvailable: env.adminMfaConfigured,
    },
  });
}

export async function startAdminMfaSetup(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!env.adminMfaConfigured) {
    return errorResponse(response, 503, "MFA_SETUP_NOT_CONFIGURED", "Set the ADMIN_MFA_ENCRYPTION_KEY secret before setting up admin MFA.");
  }
  if (request.reader.adminMfaEnabled) {
    return errorResponse(response, 409, "MFA_ALREADY_ENABLED", "Administrator MFA is already enabled.");
  }
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!password || password.length > 128) {
    return errorResponse(response, 400, "PASSWORD_REQUIRED", "Enter your current password to set up administrator MFA.");
  }
  const user = await User.findOne({ _id: request.reader._id, role: "admin", accountStatus: "active" }).select("+passwordHash");
  if (!user || !await user.verifyPassword(password)) {
    return errorResponse(response, 401, "INVALID_CREDENTIALS", "Your current password is incorrect.");
  }

  const enrollment = createAdminMfaEnrollment(user.email);
  await AdminMfa.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        encryptedSecret: enrollment.encryptedSecret,
        enabled: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        recoveryCodeHashes: [],
      },
      $setOnInsert: { userId: user._id },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return response.json({ data: { secret: enrollment.secret, otpauthUrl: enrollment.otpauthUrl, expiresInSeconds: 600 } });
}

export async function confirmAdminMfaSetup(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!env.adminMfaConfigured) {
    return errorResponse(response, 503, "MFA_SETUP_NOT_CONFIGURED", "Administrator MFA is temporarily unavailable.");
  }
  if (request.reader.adminMfaEnabled) {
    return errorResponse(response, 409, "MFA_ALREADY_ENABLED", "Administrator MFA is already enabled.");
  }
  const code = typeof request.body?.code === "string" ? request.body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return errorResponse(response, 400, "INVALID_MFA_CODE", "Enter the six-digit code from your authenticator app.");
  }

  const session = await mongoose.startSession();
  let recoveryCodes = [];
  try {
    await session.withTransaction(async () => {
      const pending = await AdminMfa.findOne({
        userId: request.reader._id,
        enabled: false,
        expiresAt: { $gt: new Date() },
      }).select("+encryptedSecret").session(session);
      if (!pending) {
        const error = new Error("MFA_SETUP_EXPIRED");
        error.code = "MFA_SETUP_EXPIRED";
        throw error;
      }
      let secret;
      try {
        secret = decryptAdminMfaSecret(pending.encryptedSecret);
      } catch {
        const error = new Error("MFA_CONFIGURATION_UNAVAILABLE");
        error.code = "MFA_CONFIGURATION_UNAVAILABLE";
        throw error;
      }
      if (!verifyAdminMfaCode(secret, code)) {
        const error = new Error("INVALID_MFA_CODE");
        error.code = "INVALID_MFA_CODE";
        throw error;
      }

      recoveryCodes = generateRecoveryCodes();
      pending.enabled = true;
      pending.expiresAt = null;
      pending.recoveryCodeHashes = recoveryCodes.map(hashRecoveryCode);
      await pending.save({ session });
      const updated = await User.updateOne(
        { _id: request.reader._id, role: "admin", accountStatus: "active" },
        { $set: { adminMfaEnabled: true } },
        { session },
      );
      if (updated.modifiedCount !== 1) {
        const error = new Error("ADMIN_ACCOUNT_UNAVAILABLE");
        error.code = "ADMIN_ACCOUNT_UNAVAILABLE";
        throw error;
      }
    });
  } catch (error) {
    if (error.code === "MFA_SETUP_EXPIRED") {
      return errorResponse(response, 400, error.code, "This setup expired. Start again to get a new authenticator key.");
    }
    if (error.code === "INVALID_MFA_CODE") {
      return errorResponse(response, 400, error.code, "That authenticator code is incorrect. Try the current six-digit code.");
    }
    if (error.code === "MFA_CONFIGURATION_UNAVAILABLE") {
      return errorResponse(response, 503, error.code, "Administrator MFA is temporarily unavailable.");
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return response.json({ data: { enabled: true, recoveryCodes } });
}
