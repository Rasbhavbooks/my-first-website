import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAuthor, requireReader } from "./auth.middleware.js";
import { getMyAuthorProfile, updateMyAuthorProfile } from "./authors.controller.js";
import { createAuthorBookDraft, listMyAuthorBooks, submitAuthorBook, updateAuthorBookDraft } from "../books/author-books.controller.js";

const router = Router();
const bookWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const profileWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAuthor);
router.get("/profile", getMyAuthorProfile);
router.patch("/profile", profileWriteLimiter, updateMyAuthorProfile);
router.get("/books", listMyAuthorBooks);
router.post("/books", bookWriteLimiter, createAuthorBookDraft);
router.patch("/books/:bookId", bookWriteLimiter, updateAuthorBookDraft);
router.post("/books/:bookId/submit", bookWriteLimiter, submitAuthorBook);

export default router;
