import { Router } from "express";
import { getPublishedBlogPost, listPublishedBlogPosts } from "./blog-posts.controller.js";

const router = Router();
router.get("/", listPublishedBlogPosts);
router.get("/:slug", getPublishedBlogPost);
export default router;
