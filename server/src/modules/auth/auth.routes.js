import { rateLimit } from "express-rate-limit";
import { raw, Router } from "express";
import {
  changeReaderPassword,
  getReaderProfile,
  getReaderSession,
  loginReader,
  logoutReader,
  registerReader,
  requestReaderVerification,
  requestPasswordReset,
  resetReaderPassword,
  updateReaderProfile,
  verifyReaderEmail,
} from "./auth.controller.js";
import { requireReader } from "./auth.middleware.js";
import { exportReaderAccountData } from "./account-data-export.controller.js";
import { listReaderSessions, revokeReaderSession } from "./reader-sessions.controller.js";
import { deleteReaderAvatar, getReaderAvatar, uploadReaderAvatar } from "./reader-avatar.controller.js";

const router = Router();
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const sessionManagementLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const avatarUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const accountExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post("/register", registrationLimiter, registerReader);
router.post("/verify-email", verificationLimiter, verifyReaderEmail);
router.post("/resend-verification", verificationLimiter, requestReaderVerification);
router.post("/login", loginLimiter, loginReader);
router.get("/session", getReaderSession);
router.post("/logout", logoutReader);
router.get("/profile/export", requireReader, accountExportLimiter, exportReaderAccountData);
router.get("/profile/photo", requireReader, getReaderAvatar);
router.put("/profile/photo", requireReader, avatarUploadLimiter, raw({ type: "*/*", limit: "5mb" }), uploadReaderAvatar);
router.delete("/profile/photo", requireReader, deleteReaderAvatar);
router.get("/sessions", requireReader, sessionManagementLimiter, listReaderSessions);
router.delete("/sessions/:sessionId", requireReader, sessionManagementLimiter, revokeReaderSession);
router.get("/profile", requireReader, getReaderProfile);
router.patch("/profile", requireReader, updateReaderProfile);
router.post("/change-password", requireReader, passwordChangeLimiter, changeReaderPassword);
router.post("/password-reset/request", passwordResetLimiter, requestPasswordReset);
router.post("/password-reset/confirm", passwordResetLimiter, resetReaderPassword);

export default router;
