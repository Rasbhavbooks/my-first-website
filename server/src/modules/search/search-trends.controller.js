import { isDatabaseConnected } from "../../config/database.js";
import Book from "../books/book.model.js";
import SearchTrend from "./search-trend.model.js";

const MIN_PUBLIC_SEARCHES = 3;
const MAX_TREND_AGE_DAYS = 90;
const TERM_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s'’.,:!?-]{1,59}$/u;

function normalizeTerm(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
}

function databaseUnavailable(response) {
  return response.status(503).json({
    error: { code: "DATABASE_UNAVAILABLE", message: "Search trends are temporarily unavailable." },
  });
}

export async function recordSearchTrend(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  if (request.body?.consent !== true) {
    return response.status(400).json({ error: { code: "CONSENT_REQUIRED", message: "Opt-in consent is required." } });
  }

  const term = normalizeTerm(request.body?.term);
  const digitCount = (term.match(/\d/g) || []).length;
  if (term.length < 2 || term.length > 60 || !TERM_PATTERN.test(term) || digitCount > 6) {
    return response.status(400).json({ error: { code: "INVALID_SEARCH_TERM", message: "This search cannot be included in trends." } });
  }

  const escapedTerm = [...term].map((character) => (
    "\\^$.*+?()[]{}|".includes(character) ? "\\" + character : character
  )).join("");
  const pattern = new RegExp(escapedTerm, "i");
  const catalogueMatch = await Book.exists({ $or: [
    { "title.en": pattern }, { "title.gu": pattern }, { "title.hi": pattern },
    { author: pattern }, { category: pattern }, { language: pattern },
  ] });
  if (!catalogueMatch) return response.status(204).end();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAX_TREND_AGE_DAYS * 24 * 60 * 60 * 1000);
  await SearchTrend.updateOne(
    { normalizedTerm: term },
    { $set: { displayTerm: term, lastSearchedAt: now, expiresAt }, $inc: { searches: 1 } },
    { upsert: true },
  );
  return response.status(204).end();
}

export async function listPopularSearchTrends(_request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const earliest = new Date(Date.now() - MAX_TREND_AGE_DAYS * 24 * 60 * 60 * 1000);
  const trends = await SearchTrend.find({
    searches: { $gte: MIN_PUBLIC_SEARCHES },
    lastSearchedAt: { $gte: earliest },
    expiresAt: { $gt: new Date() },
  }).sort({ searches: -1, lastSearchedAt: -1 }).limit(8).select("displayTerm -_id").lean();
  return response.json({ data: trends.map(({ displayTerm }) => displayTerm) });
}
