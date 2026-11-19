import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { listSubmittedAuthorBooks, reviewAuthorBook } from "./author-book-admin.controller.js";
import { getAdminAuthorBookAsset } from "./author-book-assets.controller.js";
import { listSubmittedAuthorBookChapters } from "./author-book-chapters.controller.js";

const router = Router();
const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/", listSubmittedAuthorBooks);
router.get("/:bookId/assets/:assetType", getAdminAuthorBookAsset);
router.get("/:bookId/chapters", listSubmittedAuthorBookChapters);
router.patch("/:bookId", reviewLimiter, reviewAuthorBook);

export default router;
