import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireReader } from "../auth/auth.middleware.js";
import { getBook, getRelatedBooks, listBooks } from "./books.controller.js";
import {
  addHelpfulVote,
  createBookReview,
  deleteBookReview,
  getMyBookReview,
  listBookReviews,
  listMyHelpfulVotes,
  removeHelpfulVote,
  reportBookReview,
  updateBookReview,
} from "./reviews.controller.js";

import readEbook from "./reading.controller.js";

const router = Router();
const reviewWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const helpfulVoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
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
router.get("/:bookId/related", getRelatedBooks);
router.get("/:bookId/read", requireReader, readEbook);
router.get("/:bookId/reviews", listBookReviews);
router.get("/:bookId/reviews/mine", requireReader, getMyBookReview);
router.get("/:bookId/reviews/helpful", requireReader, listMyHelpfulVotes);
router.post("/:bookId/reviews", requireReader, reviewWriteLimiter, createBookReview);
router.post("/:bookId/reviews/:reviewId/helpful", requireReader, helpfulVoteLimiter, addHelpfulVote);
router.delete("/:bookId/reviews/:reviewId/helpful", requireReader, helpfulVoteLimiter, removeHelpfulVote);
router.patch("/:bookId/reviews/:reviewId", requireReader, reviewWriteLimiter, updateBookReview);
router.delete("/:bookId/reviews/:reviewId", requireReader, reviewWriteLimiter, deleteBookReview);
router.post("/:bookId/reviews/:reviewId/report", requireReader, reportLimiter, reportBookReview);
router.get("/:bookId", getBook);
export default router;
