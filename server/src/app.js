import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRoutes from "./modules/health/health.routes.js";
import bookRoutes from "./modules/books/books.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import wishlistRoutes from "./modules/wishlist/wishlist.routes.js";
import followsRoutes from "./modules/auth/follows.routes.js";
import reviewModerationRoutes from "./modules/books/review-moderation.routes.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.get("/", (_request, response) => response.json({ name: "Rasbhav Books API", version: "v1" }));
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/books", bookRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/reader/follows", followsRoutes);
app.use("/api/v1/admin/reviews", reviewModerationRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
