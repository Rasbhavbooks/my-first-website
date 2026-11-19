import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import User from "../modules/users/user.model.js";

async function bootstrapAdmin() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is required. Add it to your private environment before running this command.");
  }

  const terminal = createInterface({ input: stdin, output: stdout });
  let connected = false;
  try {
    const email = (await terminal.question("Enter the email of an existing verified reader account: "))
      .trim()
      .toLowerCase();
    if (!email || email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      throw new Error("Enter a valid account email.");
    }

    const confirmation = await terminal.question(`Type PROMOTE ${email} to grant the first admin role: `);
    if (confirmation.trim() !== `PROMOTE ${email}`) {
      throw new Error("Confirmation did not match. No account was changed.");
    }

    await connectDatabase(env.mongoUri);
    connected = true;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const existingAdmin = await User.exists({ role: "admin" }).session(session);
        if (existingAdmin) {
          throw new Error("An admin already exists. This one-time bootstrap can only create the first admin.");
        }

        const user = await User.findOne({
          email,
          role: "reader",
          accountStatus: "active",
          emailVerifiedAt: { $ne: null },
        }).select("_id email displayName").session(session);
        if (!user) {
          throw new Error("No active, email-verified reader account matches that email.");
        }

        const result = await User.updateOne(
          {
            _id: user._id,
            role: "reader",
            accountStatus: "active",
            emailVerifiedAt: { $ne: null },
          },
          { $set: { role: "admin" } },
          { session, runValidators: true },
        );
        if (result.modifiedCount !== 1) {
          throw new Error("The account changed before promotion. No admin role was granted.");
        }
      });
    } finally {
      await session.endSession();
    }

    console.info("The verified account now has admin access. Sign in through the separate admin login page.");
  } finally {
    terminal.close();
    if (connected) await disconnectDatabase();
  }
}

bootstrapAdmin().catch((error) => {
  console.error("Admin bootstrap was not completed:", error.message);
  process.exitCode = 1;
});
