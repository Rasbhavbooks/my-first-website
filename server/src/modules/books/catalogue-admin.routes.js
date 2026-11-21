import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { listAdminCatalogueBooks, updateAdminCatalogueBook } from "./catalogue-admin.controller.js";

const router = Router();
const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/", listAdminCatalogueBooks);
router.patch("/:bookId", updateLimiter, updateAdminCatalogueBook);

export default router;
