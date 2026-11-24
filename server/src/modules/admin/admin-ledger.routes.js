import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireAdmin, requireReader } from "../auth/auth.middleware.js";
import { listAdminLedgerTransactions } from "./admin-ledger.controller.js";

const router = Router();
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader, requireAdmin);
router.get("/", readLimiter, listAdminLedgerTransactions);

export default router;
