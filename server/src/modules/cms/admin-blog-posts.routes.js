import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { createBlogPost, listAdminBlogPosts, updateBlogPost } from "./blog-posts.controller.js";

const router = Router();
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/", listAdminBlogPosts);
router.post("/", writeLimiter, createBlogPost);
router.patch("/:slug", writeLimiter, updateBlogPost);
export default router;
