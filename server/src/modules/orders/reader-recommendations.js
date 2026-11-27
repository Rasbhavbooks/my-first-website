import Book from "../books/book.model.js";
import { serializeBook } from "../books/books.controller.js";
import { Completion } from "./reader-challenge.js";
import Entitlement from "./book-entitlement.model.js";

export async function listReaderRecommendations(request, response) {
  response.set("Cache-Control", "private, no-store");
  const readerId = request.reader._id;
  const recent = await Completion.find({ readerId }).sort({ completedAt: -1 }).limit(24).select("bookId -_id").lean();
  const finishedIds = recent.map(entry => entry.bookId);
  if (!finishedIds.length) return response.json({ data: { books: [] } });

  const finished = await Book.find({ catalogueId: { $in: finishedIds } }).select("category language -_id").lean();
  const categories = new Map();
  const languages = new Map();
  for (const book of finished) {
    categories.set(book.category, (categories.get(book.category) ?? 0) + 1);
    languages.set(book.language, (languages.get(book.language) ?? 0) + 1);
  }
  if (!categories.size) return response.json({ data: { books: [] } });

  const candidates = await Book.find({
    category: { $in: [...categories.keys()] },
    catalogueId: { $nin: finishedIds },
  }).sort({ createdAt: -1, catalogueId: 1 }).limit(48)
    .select("catalogueId title description author language category price tone badge").lean();

  const candidateIds = candidates.map(book => book.catalogueId);
  const [finishedCandidates, ownedCandidates] = await Promise.all([
    Completion.find({ readerId, bookId: { $in: candidateIds } }).select("bookId -_id").lean(),
    Entitlement.find({ readerId, bookId: { $in: candidateIds } }).select("bookId -_id").lean(),
  ]);
  const excluded = new Set([...finishedCandidates, ...ownedCandidates].map(entry => entry.bookId));
  const score = book => (categories.get(book.category) ?? 0) * 2 + (languages.get(book.language) ?? 0);
  const books = candidates.filter(book => !excluded.has(book.catalogueId))
    .sort((left, right) => score(right) - score(left)).slice(0, 6).map(serializeBook);
  return response.json({ data: { books } });
}
