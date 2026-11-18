import { Router } from "express";
import { getBook, listBooks } from "./books.controller.js";

const router = Router();
router.get("/", listBooks);
router.get("/:bookId", getBook);
export default router;
