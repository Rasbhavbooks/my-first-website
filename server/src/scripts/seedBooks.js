import "dotenv/config";
import { books, categoryDefinitions } from "../../../shared/catalogue.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import Book from "../modules/books/book.model.js";
import Category from "../modules/books/category.model.js";

async function seedBooks() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is required. Add the Codespaces secret before seeding.");
  }

  await connectDatabase(env.mongoUri);
  try {
    const categoryOperations = categoryDefinitions.map(({ key, labels, sortOrder }) => ({
      updateOne: { filter: { key }, update: { $setOnInsert: { key, labels, sortOrder, active: true } }, upsert: true },
    }));
    await Category.bulkWrite(categoryOperations);
    const operations = books.map(({ id, ...book }) => ({
      updateOne: {
        filter: { catalogueId: id },
        update: { $set: { ...book, catalogueId: id } },
        upsert: true,
      },
    }));
    const result = await Book.bulkWrite(operations);
    console.info(
      `Default categories and sample catalogue saved to MongoDB. Added: ${result.upsertedCount}; updated: ${result.modifiedCount}.`,
    );
  } finally {
    await disconnectDatabase();
  }
}

seedBooks().catch((error) => {
  console.error("Could not seed the book catalogue.", error);
  process.exitCode = 1;
});
