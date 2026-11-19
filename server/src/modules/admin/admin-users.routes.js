import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { listAdminUsers, updateAdminUserStatus } from "./admin-users.controller.js";

const router = Router();
const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/", listAdminUsers);
router.patch("/:userId/status", statusLimiter, updateAdminUserStatus);

export default router;
