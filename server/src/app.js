import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import healthRoutes from "./modules/health/health.routes.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (_request, response) => {
  response.json({ name: "Rasbhav Books API", version: "v1" });
});
app.use("/api/v1/health", healthRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
