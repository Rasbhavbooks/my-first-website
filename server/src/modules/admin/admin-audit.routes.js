import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { listAdminAuditEvents } from "./admin-audit.controller.js";

const router = Router();
router.use(requireReader, requireAdmin);
router.get("/", listAdminAuditEvents);

export default router;
