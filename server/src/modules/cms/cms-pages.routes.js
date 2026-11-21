import { Router } from "express";
import { getPublishedCmsPage, listPublishedCmsPages } from "./cms-pages.controller.js";

const router = Router();
router.get("/", listPublishedCmsPages);
router.get("/:slug", getPublishedCmsPage);
export default router;
