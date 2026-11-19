import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import {
  changeReaderPassword,
  getReaderProfile,
  getReaderSession,
  loginReader,
  logoutReader,
  registerReader,
  updateReaderProfile,
  verifyReaderEmail,
} from "./auth.controller.js";
import { requireReader } from "./auth.middleware.js";

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
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post("/register", registrationLimiter, registerReader);
router.post("/verify-email", verificationLimiter, verifyReaderEmail);
router.post("/login", loginLimiter, loginReader);
router.get("/session", getReaderSession);
router.post("/logout", logoutReader);
router.get("/profile", requireReader, getReaderProfile);
router.patch("/profile", requireReader, updateReaderProfile);
router.post("/change-password", requireReader, passwordChangeLimiter, changeReaderPassword);

export default router;
