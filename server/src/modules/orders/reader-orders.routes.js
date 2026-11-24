import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireReader } from "../auth/auth.middleware.js";
import { listReaderOrders } from "./reader-orders.controller.js";

const router = Router();

router.get(
  "/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  requireReader,
  listReaderOrders,
);

export default router;
