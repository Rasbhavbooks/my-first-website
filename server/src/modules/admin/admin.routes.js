import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { getAdminDashboardStats, getAdminPlatformReadiness } from "./admin-dashboard.controller.js";

const router = Router();
router.use(requireReader, requireAdmin);
router.get("/", getAdminDashboardStats);
router.get("/readiness", getAdminPlatformReadiness);

export default router;
