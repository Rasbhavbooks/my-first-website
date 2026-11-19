import { isDatabaseConnected } from "../../config/database.js";
import Book from "../books/book.model.js";
import AuthorFollow from "./author-follow.model.js";

function normalizeAuthorName(name) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function databaseUnavailable(response) {
  return response.status(503).json({
    error: { code: "DATABASE_UNAVAILABLE", message: "Author follows are temporarily unavailable." },
  });
}

export async function listFollowedAuthors(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const follows = await AuthorFollow.find({ userId: request.reader._id }).sort({ authorName: 1 }).lean();
  return response.json({
    data: { authors: follows.map(({ authorKey, authorName, createdAt }) => ({ authorKey, authorName, followedAt: createdAt })) },
  });
}

export async function followAuthor(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const authorName = typeof request.body?.authorName === "string" ? request.body.authorName.trim().replace(/\s+/g, " ") : "";
  if (!authorName || authorName.length > 120) {
    return response.status(400).json({
      error: { code: "INVALID_AUTHOR", message: "Enter a valid author name." },
    });
  }

  const authorPattern = new RegExp(`^${escapeRegex(authorName)}$`, "i");
  const exists = await Book.exists({ author: authorPattern });
  if (!exists) {
    return response.status(404).json({
      error: { code: "AUTHOR_NOT_FOUND", message: "This author was not found in the catalogue." },
    });
  }

  const authorKey = normalizeAuthorName(authorName);
  try {
    const follow = await AuthorFollow.findOneAndUpdate(
      { userId: request.reader._id, authorKey },
      { $setOnInsert: { userId: request.reader._id, authorKey, authorName } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return response.status(201).json({
      data: { author: { authorKey: follow.authorKey, authorName: follow.authorName } },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ error: { code: "ALREADY_FOLLOWING", message: "You already follow this author." } });
    }
    throw error;
  }
}

export async function unfollowAuthor(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const authorName = typeof request.params.authorName === "string" ? request.params.authorName.trim() : "";
  const authorKey = normalizeAuthorName(authorName);
  if (!authorKey || authorKey.length > 120) {
    return response.status(400).json({
      error: { code: "INVALID_AUTHOR", message: "A valid author is required." },
    });
  }
  await AuthorFollow.deleteOne({ userId: request.reader._id, authorKey });
  return response.json({ data: { authorKey, following: false } });
}
