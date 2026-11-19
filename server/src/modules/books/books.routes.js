import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireReader } from "../auth/auth.middleware.js";
import { getBook, listBooks } from "./books.controller.js";
import {
  createBookReview,
  deleteBookReview,
  getMyBookReview,
  listBookReviews,
  reportBookReview,
  updateBookReview,
} from "./reviews.controller.js";

const router = Router();
const reviewWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/", listBooks);
router.get("/:bookId/reviews", listBookReviews);
router.get("/:bookId/reviews/mine", requireReader, getMyBookReview);
router.post("/:bookId/reviews", requireReader, reviewWriteLimiter, createBookReview);
router.patch("/:bookId/reviews/:reviewId", requireReader, reviewWriteLimiter, updateBookReview);
router.delete("/:bookId/reviews/:reviewId", requireReader, reviewWriteLimiter, deleteBookReview);
router.post("/:bookId/reviews/:reviewId/report", requireReader, reportLimiter, reportBookReview);
router.get("/:bookId", getBook);
export default router;
