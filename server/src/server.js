import "dotenv/config";
import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

async function startServer() {
  if (env.mongoUri) {
    await connectDatabase(env.mongoUri);
  } else {
    console.warn("MONGODB_URI is not set. Starting API without a database connection.");
  }

  const httpServer = app.listen(env.port, "0.0.0.0", () => {
    console.info(`Rasbhav Books API listening on port ${env.port}.`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      httpServer.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    });
  }
}

startServer().catch((error) => {
  console.error("Could not start the API server.", error);
  process.exitCode = 1;
});
