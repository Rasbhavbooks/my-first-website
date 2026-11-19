import { Router } from "express";
import { requireAuthor, requireReader } from "./auth.middleware.js";
import { getMyAuthorProfile, updateMyAuthorProfile } from "./authors.controller.js";

const router = Router();
router.use(requireReader, requireAuthor);
router.get("/profile", getMyAuthorProfile);
router.patch("/profile", updateMyAuthorProfile);

export default router;
