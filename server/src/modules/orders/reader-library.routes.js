import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireReader } from "../auth/auth.middleware.js";
import { getReaderLibraryBook, listReaderLibrary, listRecentlyOpenedBooks } from "./reader-library.controller.js";

const router = Router();
const libraryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/", libraryLimiter, requireReader, listReaderLibrary);
router.get("/recent", libraryLimiter, requireReader, listRecentlyOpenedBooks);
router.get("/:bookId", libraryLimiter, requireReader, getReaderLibraryBook);

export default router;
