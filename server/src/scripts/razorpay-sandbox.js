import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";

export const sandboxCatalogueId = "phase7-razorpay-sandbox";

export async function withRazorpaySandbox(database, task) {
  const uri = process.env.RAZORPAY_SANDBOX_MONGODB_URI;
  if (process.env.NODE_ENV === "production" || !env.razorpayConfigured || env.razorpayMode !== "test") {
    throw new Error("A development environment and Razorpay test credentials are required.");
  }
  if (!uri || uri === env.mongoUri) {
    throw new Error("Set RAZORPAY_SANDBOX_MONGODB_URI to a separate test database connection.");
  }

  // Disable automatic collection and index creation until the selected database is verified.
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  try {
    await connectDatabase(uri);
    if (mongoose.connection.name !== database) {
      throw new Error("The connected database does not match --test-database.");
    }
    return await task();
  } finally {
    await disconnectDatabase();
  }
}
