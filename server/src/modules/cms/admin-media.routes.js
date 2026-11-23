import express from "express";
import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { deleteAdminMedia, listAdminMedia, updateAdminMedia, uploadAdminMedia } from "./media.controller.js";

const router = Router();
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const imageBody = express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" });

router.use(requireReader, requireAdmin);
router.get("/", listAdminMedia);
router.post("/", writeLimiter, imageBody, uploadAdminMedia);
router.patch("/:assetId", writeLimiter, updateAdminMedia);
router.delete("/:assetId", writeLimiter, deleteAdminMedia);
export default router;
