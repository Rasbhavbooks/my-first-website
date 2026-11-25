import { isDatabaseConnected } from "../../config/database.js";
import Book from "./book.model.js";
import { cataloguePriceFilter } from "./catalogue-query.js";

function serializeBook(record) {
  const {
    _id,
    catalogueId,
    createdAt,
    updatedAt,
    ...book
  } = record;
  return { ...book, id: catalogueId };
}

function databaseUnavailable(response) {
  return response.status(503).json({
    error: {
      code: "DATABASE_UNAVAILABLE",
      message: "The book catalogue is temporarily unavailable.",
    },
  });
}

const PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const BOOK_LANGUAGES = new Set(["Gujarati", "Hindi", "English"]);
const LOCALES = new Set(["en", "gu", "hi"]);

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

function escapeRegex(value) {
  const specialCharacters = "\\^$.*+?()[]{}|";
  return [...value].map((character) => (
    specialCharacters.includes(character) ? "\\" + character : character
  )).join("");
}
export async function listBooks(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const hasPaging = ["page", "limit", "q", "category", "bookLanguage", "priceType", "sort", "locale"]
    .some((key) => Object.hasOwn(request.query, key));
  if (!hasPaging) {
    const records = await Book.find().sort({ catalogueId: 1 }).lean();
    return response.json({ data: records.map(serializeBook) });
  }

  const page = parsePositiveInteger(request.query.page, 1, 100000);
  const limit = parsePositiveInteger(request.query.limit, PAGE_SIZE, MAX_PAGE_SIZE);
  const query = request.query.q === undefined ? "" : request.query.q;
  const category = request.query.category === undefined ? "" : request.query.category;
  const bookLanguage = request.query.bookLanguage === undefined ? "" : request.query.bookLanguage;
  const priceType = request.query.priceType === undefined ? "all" : request.query.priceType;
  const priceFilter = cataloguePriceFilter(priceType);
  const sortBy = request.query.sort === undefined ? "featured" : request.query.sort;
  const locale = request.query.locale === undefined ? "en" : request.query.locale;
  if (page === null || limit === null
    || typeof query !== "string" || query.length > 100
    || typeof category !== "string" || category.length > 50
    || typeof bookLanguage !== "string" || (bookLanguage && !BOOK_LANGUAGES.has(bookLanguage))
    || !priceFilter
    || !["featured", "title", "author"].includes(sortBy)
    || typeof locale !== "string" || !LOCALES.has(locale)) {
    return response.status(400).json({
      error: { code: "INVALID_CATALOGUE_QUERY", message: "Check the catalogue search and pagination filters." },
    });
  }

  const filters = { ...priceFilter };
  if (category && category !== "All") filters.category = category;
  if (bookLanguage) filters.language = bookLanguage;
  if (query.trim()) {
    const pattern = new RegExp(escapeRegex(query.trim()), "i");
    filters.$or = [
      ...["en", "gu", "hi"].flatMap((language) => [
        { [`title.${language}`]: pattern },
        { [`description.${language}`]: pattern },
      ]),
      { author: pattern },
      { category: pattern },
      { language: pattern },
      { isbn: pattern },
    ];
  }
  const sort = sortBy === "author"
    ? { author: 1, catalogueId: 1 }
    : sortBy === "title"
      ? { [`title.${locale}`]: 1, catalogueId: 1 }
      : { catalogueId: 1 };
  const [records, total] = await Promise.all([
    Book.find(filters).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Book.countDocuments(filters),
  ]);
  return response.json({
    data: {
      items: records.map(serializeBook),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function getRelatedBooks(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const limit = parsePositiveInteger(request.query.limit, 4, 12);
  if (limit === null) {
    return response.status(400).json({
      error: { code: "INVALID_RECOMMENDATION_LIMIT", message: "Choose a limit from 1 to 12." },
    });
  }

  const book = await Book.findOne({ catalogueId: request.params.bookId }).lean();
  if (!book) {
    return response.status(404).json({
      error: { code: "BOOK_NOT_FOUND", message: "Book not found." },
    });
  }

  const candidates = await Book.find({
    catalogueId: { $ne: book.catalogueId },
    $or: [
      { category: book.category },
      { language: book.language },
      { author: book.author },
    ],
  }).sort({ catalogueId: 1 }).limit(Math.min(limit * 8, 96)).lean();

  const recommendations = candidates
    .map((candidate) => ({
      candidate,
      score: (candidate.category === book.category ? 4 : 0)
        + (candidate.language === book.language ? 2 : 0)
        + (candidate.author === book.author ? 3 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score
      || left.candidate.catalogueId.localeCompare(right.candidate.catalogueId))
    .slice(0, limit)
    .map(({ candidate }) => serializeBook(candidate));

  return response.json({ data: recommendations });
}

export async function getBook(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const record = await Book.findOne({ catalogueId: request.params.bookId }).lean();
  if (!record) {
    return response.status(404).json({
      error: { code: "BOOK_NOT_FOUND", message: "Book not found." },
    });
  }
  return response.json({ data: serializeBook(record) });
}
