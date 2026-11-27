import "dotenv/config";
import { books, categoryDefinitions } from "../../../shared/catalogue.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import Book from "../modules/books/book.model.js";
import Category from "../modules/books/category.model.js";

const reviewBooks = [
  {
    catalogueId: "phase7-review-paid",
    title: { en: "Test eBook ₹100", gu: "ટેસ્ટ ઇબુક ₹100", hi: "टेस्ट ईबुक ₹100" },
    price: 100,
  },
  {
    catalogueId: "phase7-review-free",
    title: { en: "Free test eBook", gu: "મફત ટેસ્ટ ઇબુક", hi: "मुफ़्त टेस्ट ईबुक" },
    price: 0,
  },
];

async function seedBooks() {
  const reviewOnly = process.argv.includes("--review-fixtures");
  if (reviewOnly && process.env.NODE_ENV === "production") {
    throw new Error("Review fixtures require a development database.");
  }
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is required. Add the Codespaces secret before seeding.");
  }

  await connectDatabase(env.mongoUri);
  try {
    const categoryOperations = categoryDefinitions.map(({ key, labels, sortOrder }) => ({
      updateOne: { filter: { key }, update: { $setOnInsert: { key, labels, sortOrder, active: true } }, upsert: true },
    }));
    await Category.bulkWrite(categoryOperations);
    if (reviewOnly) {
      const description = {
        en: "Sample listing for reviewing the test catalogue.",
        gu: "ટેસ્ટ કેટલોગ ચકાસવા માટેનું નમૂનાનું પુસ્તક.",
        hi: "टेस्ट कैटलॉग की जाँच के लिए नमूना पुस्तक।",
      };
      await Book.bulkWrite(reviewBooks.map(book => ({
        updateOne: {
          filter: { catalogueId: book.catalogueId },
          update: { $setOnInsert: {
            ...book, description, author: "Rasbhav Books", category: "Novel",
            language: "Gujarati", tone: "sage", availableForSale: false,
          } },
          upsert: true,
        },
      })));
      console.info("Phase 7 review fixtures are ready.");
      return;
    }
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
