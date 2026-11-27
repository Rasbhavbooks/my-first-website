import { deleteReadingCompletion, getReadingChallenge, getReadingCompletion, saveReadingCompletion } from "./reader-challenge.js";
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
router.get("/challenge", libraryLimiter, requireReader, getReadingChallenge);
router.get("/:bookId/completion", libraryLimiter, requireReader, getReadingCompletion);
router.put("/:bookId/completion", libraryLimiter, requireReader, saveReadingCompletion);
router.delete("/:bookId/completion", libraryLimiter, requireReader, deleteReadingCompletion);
router.get("/:bookId", libraryLimiter, requireReader, getReaderLibraryBook);

export default router;
