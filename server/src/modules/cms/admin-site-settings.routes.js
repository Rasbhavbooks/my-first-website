import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { getAdminSiteContent, updateAdminSiteContent } from "./site-settings.controller.js";

const router = Router();
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
router.use(requireReader, requireAdmin);
router.get("/", getAdminSiteContent);
router.patch("/", writeLimiter, updateAdminSiteContent);
export default router;
