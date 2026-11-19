import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "./auth.middleware.js";
import { listAuthorApplications, reviewAuthorApplication } from "./author-admin.controller.js";

const router = Router();
const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/", listAuthorApplications);
router.patch("/:applicationId", reviewLimiter, reviewAuthorApplication);
export default router;
