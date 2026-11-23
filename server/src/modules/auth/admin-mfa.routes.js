import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdminIdentity, requireReader } from "./auth.middleware.js";
import { confirmAdminMfaSetup, getAdminMfaStatus, startAdminMfaSetup } from "./admin-mfa.controller.js";

const router = Router();
const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdminIdentity);
router.get("/status", getAdminMfaStatus);
router.post("/setup", setupLimiter, startAdminMfaSetup);
router.post("/confirm", setupLimiter, confirmAdminMfaSetup);

export default router;
