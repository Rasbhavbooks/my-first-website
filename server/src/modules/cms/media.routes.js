import { Router } from "express";
import { getPublishedMedia } from "./media.controller.js";

const router = Router();
router.get("/:assetId", getPublishedMedia);
export default router;
