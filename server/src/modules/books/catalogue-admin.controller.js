import Book from "./book.model.js";
import Category from "./category.model.js";

const PAGE_SIZE = 30;
const LANGUAGES = new Set(["Gujarati", "Hindi", "English"]);
const FIELDS = ["en", "gu", "hi"];

function escapeRegex(value) {
  const specialCharacters = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);
  return [...value].map((character) => specialCharacters.has(character) ? "\\" + character : character).join("");
}

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function validLocalizedText(value, maxLength) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return FIELDS.every((field) => typeof value[field] === "string" && value[field].trim().length > 0 && value[field].trim().length <= maxLength);
}

function bookDto(book) {
  return {
    id: book.catalogueId,
    title: book.title,
    author: book.author,
    language: book.language,
    category: book.category,
    price: book.price,
    tone: book.tone,
    badge: book.badge,
    description: book.description,
  };
}

export async function listAdminCatalogueBooks(request, response) {
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const category = typeof request.query.category === "string" ? request.query.category : "";
  const page = request.query.page === undefined ? 1 : Number(request.query.page);
  const activeCategory = category && category !== "All" ? await Category.exists({ key: category, active: true }) : true;
  if (search.length > 100 || (category && !activeCategory)) {
    return errorResponse(response, 400, "INVALID_CATALOGUE_FILTER", "Check the book search and category.");
  }
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    return errorResponse(response, 400, "INVALID_PAGE", "Choose a valid page number.");
  }

  const filter = {};
  if (category && category !== "All") filter.category = category;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { author: pattern },
      { catalogueId: pattern },
      { "title.en": pattern },
      { "title.gu": pattern },
      { "title.hi": pattern },
    ];
  }
  const [total, books] = await Promise.all([
    Book.countDocuments(filter),
    Book.find(filter).sort({ catalogueId: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
  ]);
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { books: books.map(bookDto), pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } } });
}

export async function updateAdminCatalogueBook(request, response) {
  const catalogueId = typeof request.params.bookId === "string" ? request.params.bookId.trim() : "";
  if (!catalogueId || catalogueId.length > 120) return errorResponse(response, 400, "INVALID_BOOK_ID", "Choose a valid catalogue book.");
  const body = request.body || {};
  const tone = typeof body.tone === "string" ? body.tone.trim() : "";
  const badge = typeof body.badge === "string" ? body.badge.trim() : "";
  const priceValue = body.price;
  const price = Number(priceValue);
  const validCategory = typeof body.category === "string" && await Category.exists({ key: body.category, active: true });
  if (
    !validLocalizedText(body.title, 200)
    || !validLocalizedText(body.description, 4000)
    || !LANGUAGES.has(body.language)
    || !validCategory
    || (typeof priceValue !== "number" && (typeof priceValue !== "string" || !priceValue.trim()))
    || !Number.isFinite(price) || price < 0 || price > 100000
    || !tone || tone.length > 40
    || !badge || badge.length > 40
  ) {
    return errorResponse(response, 400, "INVALID_CATALOGUE_BOOK", "Check every language field, category, price, tone, and badge.");
  }

  const book = await Book.findOneAndUpdate(
    { catalogueId },
    { $set: { title: Object.fromEntries(FIELDS.map((field) => [field, body.title[field].trim()])), description: Object.fromEntries(FIELDS.map((field) => [field, body.description[field].trim()])), language: body.language, category: body.category, price, tone, badge } },
    { new: true, runValidators: true },
  ).lean();
  if (!book) return errorResponse(response, 404, "BOOK_NOT_FOUND", "Catalogue book not found.");
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { book: bookDto(book) } });
}
