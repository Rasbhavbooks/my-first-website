import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { registerReader, verifyReaderEmail } from "./auth.controller.js";

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

router.post("/register", registrationLimiter, registerReader);
router.post("/verify-email", verificationLimiter, verifyReaderEmail);
export default router;
