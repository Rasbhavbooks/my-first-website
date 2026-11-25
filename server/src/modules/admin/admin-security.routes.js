import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { listAdminSecuritySessions } from "./admin-security-sessions.controller.js";
import { getAdminLoginSecurityMetrics } from "./admin-login-security.controller.js";

const router = Router();
const loginMetricsLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false });
router.get("/login-attempts", loginMetricsLimiter, requireReader, requireAdmin, getAdminLoginSecurityMetrics);
router.use(requireReader, requireAdmin);
router.get("/sessions", listAdminSecuritySessions);

export default router;
