import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireReader } from "./auth.middleware.js";
import { followAuthor, listFollowedAuthors, unfollowAuthor } from "./follows.controller.js";

const router = Router();
const followLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader);
router.get("/", listFollowedAuthors);
router.post("/", followLimiter, followAuthor);
router.delete("/:authorName", followLimiter, unfollowAuthor);

export default router;
