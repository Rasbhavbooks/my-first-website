import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { listAdminSecuritySessions } from "./admin-security-sessions.controller.js";

const router = Router();
router.use(requireReader, requireAdmin);
router.get("/sessions", listAdminSecuritySessions);

export default router;
