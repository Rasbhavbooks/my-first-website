import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireReader } from "../auth/auth.middleware.js";
import { listReaderOrders } from "./reader-orders.controller.js";

const router = Router();
const orderHistoryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader);
router.get("/", orderHistoryLimiter, listReaderOrders);

export default router;
