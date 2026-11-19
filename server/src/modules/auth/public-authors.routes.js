import { Router } from "express";
import { getPublicAuthorProfile } from "./authors.controller.js";

const router = Router();
router.get("/:slug", getPublicAuthorProfile);
export default router;
