import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { getAdminDashboardStats } from "./admin-dashboard.controller.js";

const router = Router();
router.use(requireReader, requireAdmin);
router.get("/", getAdminDashboardStats);

export default router;
