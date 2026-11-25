import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireReader } from "../auth/auth.middleware.js";
import { getReaderLibraryBook, listReaderLibrary, listRecentlyOpenedBooks, clearRecentlyOpenedBooks } from "./reader-library.controller.js";
import { deleteReaderBookBookmark, getReaderBookBookmark, saveReaderBookBookmark } from "./reader-bookmark.controller.js";

const router = Router();
const libraryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/", libraryLimiter, requireReader, listReaderLibrary);
router.get("/recent", libraryLimiter, requireReader, listRecentlyOpenedBooks);
router.delete("/recent", libraryLimiter, requireReader, clearRecentlyOpenedBooks);
router.get("/:bookId/bookmark", libraryLimiter, requireReader, getReaderBookBookmark);
router.put("/:bookId/bookmark", libraryLimiter, requireReader, saveReaderBookBookmark);
router.delete("/:bookId/bookmark", libraryLimiter, requireReader, deleteReaderBookBookmark);
router.get("/:bookId", libraryLimiter, requireReader, getReaderLibraryBook);

export default router;
