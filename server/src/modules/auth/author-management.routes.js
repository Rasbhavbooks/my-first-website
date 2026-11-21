import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "./auth.middleware.js";
import { listAdminAuthors, updateAdminAuthorStatus } from "./author-management.controller.js";

const router = Router();
const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/", listAdminAuthors);
router.patch("/:authorId/status", statusLimiter, updateAdminAuthorStatus);

export default router;
