import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { listPopularSearchTrends, recordSearchTrend } from "./search-trends.controller.js";

const router = Router();
const listLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false });
const recordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });

router.get("/", listLimiter, listPopularSearchTrends);
router.post("/", recordLimiter, recordSearchTrend);

export default router;
