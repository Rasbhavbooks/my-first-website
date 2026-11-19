import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAuthor, requireReader } from "./auth.middleware.js";
import { getMyAuthorProfile, updateMyAuthorProfile } from "./authors.controller.js";

const router = Router();
const profileWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAuthor);
router.get("/profile", getMyAuthorProfile);
router.patch("/profile", profileWriteLimiter, updateMyAuthorProfile);

export default router;
