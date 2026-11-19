import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireReader } from "../auth/auth.middleware.js";
import { addWishlistItem, getWishlist, removeWishlistItem } from "./wishlist.controller.js";

const router = Router();
const wishlistWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader);
router.get("/", getWishlist);
router.post("/", wishlistWriteLimiter, addWishlistItem);
router.delete("/:bookId", wishlistWriteLimiter, removeWishlistItem);

export default router;
