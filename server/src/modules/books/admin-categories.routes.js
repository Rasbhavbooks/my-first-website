import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { createCategory, listAdminCategories, updateCategory } from "./categories.controller.js";

const router = Router();
const categoryWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/", listAdminCategories);
router.post("/", categoryWriteLimiter, createCategory);
router.patch("/:key", categoryWriteLimiter, updateCategory);
export default router;
