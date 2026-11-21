import { Router } from "express";
import { getPublicSiteContent } from "./site-settings.controller.js";

const router = Router();
router.get("/", getPublicSiteContent);
export default router;
