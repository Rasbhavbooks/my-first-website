import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import {
  listReviewReports,
  moderateBookReview,
  resolveReviewReport,
} from "./review-moderation.controller.js";

const router = Router();
const moderationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/reports", listReviewReports);
router.patch("/reports/:reportId", moderationLimiter, resolveReviewReport);
router.patch("/reviews/:reviewId", moderationLimiter, moderateBookReview);

export default router;
