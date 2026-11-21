import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { createCmsPage, listAdminCmsPages, updateCmsPage } from "./cms-pages.controller.js";

const router = Router();
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/", listAdminCmsPages);
router.post("/", writeLimiter, createCmsPage);
router.patch("/:slug", writeLimiter, updateCmsPage);
export default router;
