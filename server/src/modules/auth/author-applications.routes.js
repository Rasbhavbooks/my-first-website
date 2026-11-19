import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { requireReader } from "./auth.middleware.js";
import { getMyAuthorApplication, submitAuthorApplication } from "./author-applications.controller.js";

const router = Router();
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireReader);
router.get("/me", getMyAuthorApplication);
router.post("/", submitLimiter, submitAuthorApplication);

export default router;
