import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import {
  getReaderSession,
  loginReader,
  logoutReader,
  registerReader,
  verifyReaderEmail,
} from "./auth.controller.js";

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

router.post("/register", registrationLimiter, registerReader);
router.post("/verify-email", verificationLimiter, verifyReaderEmail);
router.post("/login", loginLimiter, loginReader);
router.get("/session", getReaderSession);
router.post("/logout", logoutReader);

export default router;
