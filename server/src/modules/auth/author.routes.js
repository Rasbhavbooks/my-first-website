import { rateLimit } from "express-rate-limit";
import { raw, Router } from "express";
import { requireAuthor, requireReader } from "./auth.middleware.js";
import { getMyAuthorProfile, updateMyAuthorProfile } from "./authors.controller.js";
import { createAuthorBookDraft, listMyAuthorBooks, submitAuthorBook, updateAuthorBookDraft } from "../books/author-books.controller.js";
import { getMyAuthorBookAsset, uploadAuthorBookAsset } from "../books/author-book-assets.controller.js";
import {
  createAuthorBookChapter,
  deleteAuthorBookChapter,
  listMyAuthorBookChapters,
  updateAuthorBookChapter,
} from "../books/author-book-chapters.controller.js";

const router = Router();
const fileUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const parseBookFile = raw({
  type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  limit: "25mb",
});
function parseBookFileWithLimit(request, response, next) {
  parseBookFile(request, response, (error) => {
    if (error) error.statusCode = error.status || 413;
    next(error);
  });
}
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
router.get("/books/:bookId/chapters", listMyAuthorBookChapters);
router.post("/books/:bookId/chapters", bookWriteLimiter, createAuthorBookChapter);
router.patch("/books/:bookId/chapters/:chapterId", bookWriteLimiter, updateAuthorBookChapter);
router.delete("/books/:bookId/chapters/:chapterId", bookWriteLimiter, deleteAuthorBookChapter);
router.get("/books/:bookId/assets/:assetType", getMyAuthorBookAsset);
router.put("/books/:bookId/assets/:assetType", fileUploadLimiter, parseBookFileWithLimit, uploadAuthorBookAsset);
router.post("/books", bookWriteLimiter, createAuthorBookDraft);
router.patch("/books/:bookId", bookWriteLimiter, updateAuthorBookDraft);
router.post("/books/:bookId/submit", bookWriteLimiter, submitAuthorBook);

export default router;
