import { categoryDefinitions } from "../../../../shared/catalogue.js";
import { isDatabaseConnected } from "../../config/database.js";
import AuthorBook from "./author-book.model.js";
import Book from "./book.model.js";
import Category from "./category.model.js";

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

async function ensureDefaultCategories() {
  const keys = categoryDefinitions.map(({ key }) => key);
  const existing = await Category.countDocuments({ key: { $in: keys } });
  if (existing === keys.length) return;
  await Category.bulkWrite(categoryDefinitions.map(({ key, labels, sortOrder }) => ({
    updateOne: {
      filter: { key },
      update: { $setOnInsert: { key, labels, sortOrder, active: true } },
      upsert: true,
    },
  })));
}

function normalizeLabels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const labels = {};
  for (const language of ["en", "gu", "hi"]) {
    if (typeof value[language] !== "string") return null;
    labels[language] = value[language].trim();
    if (!labels[language] || labels[language].length > 80) return null;
  }
  return labels;
}

function categoryDto(category, catalogueCounts, draftCounts) {
  return {
    key: category.key,
    labels: category.labels,
    active: category.active,
    sortOrder: category.sortOrder,
    usage: {
      catalogueBooks: catalogueCounts.get(category.key) || 0,
      authorBooks: draftCounts.get(category.key) || 0,
    },
    updatedAt: category.updatedAt,
  };
}

export async function listCategories(_request, response) {
  if (!isDatabaseConnected()) return errorResponse(response, 503, "DATABASE_UNAVAILABLE", "Categories are temporarily unavailable.");
  await ensureDefaultCategories();
  const categories = await Category.find({ active: true }).sort({ sortOrder: 1, key: 1 }).select("key labels sortOrder").lean();
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({ data: { categories } });
}

export async function listAdminCategories(_request, response) {
  await ensureDefaultCategories();
  const [categories, catalogueCounts, draftCounts] = await Promise.all([
    Category.find().sort({ sortOrder: 1, key: 1 }).lean(),
    Book.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
    AuthorBook.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
  ]);
  const catalogueMap = new Map(catalogueCounts.map(({ _id, count }) => [_id, count]));
  const draftMap = new Map(draftCounts.map(({ _id, count }) => [_id, count]));
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { categories: categories.map((category) => categoryDto(category, catalogueMap, draftMap)) } });
}

export async function createCategory(request, response) {
  const key = typeof request.body?.key === "string" ? request.body.key.trim() : "";
  const labels = normalizeLabels(request.body?.labels);
  const sortOrder = request.body?.sortOrder === undefined ? 100 : Number(request.body.sortOrder);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || key.length > 50 || key.toLowerCase() === "all"
    || !labels || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
    return errorResponse(response, 400, "INVALID_CATEGORY", "Check the category key, all three labels, and display order.");
  }

  try {
    const category = await Category.create({ key, labels, sortOrder, active: true });
    response.setHeader("Cache-Control", "no-store");
    return response.status(201).json({ data: { category: categoryDto(category.toObject(), new Map(), new Map()) } });
  } catch (error) {
    if (error?.code === 11000) return errorResponse(response, 409, "CATEGORY_EXISTS", "That category key is already in use.");
    if (error?.name === "ValidationError") return errorResponse(response, 400, "INVALID_CATEGORY", "Check the category key, labels, and display order.");
    throw error;
  }
}

export async function updateCategory(request, response) {
  const key = typeof request.params.key === "string" ? request.params.key : "";
  const update = {};
  if (request.body?.labels !== undefined) {
    const labels = normalizeLabels(request.body.labels);
    if (!labels) return errorResponse(response, 400, "INVALID_CATEGORY_LABELS", "Enter a label in English, Gujarati, and Hindi.");
    update.labels = labels;
  }
  if (request.body?.sortOrder !== undefined) {
    const sortOrder = Number(request.body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) return errorResponse(response, 400, "INVALID_CATEGORY_ORDER", "Choose a valid display order.");
    update.sortOrder = sortOrder;
  }
  if (request.body?.active !== undefined) {
    if (typeof request.body.active !== "boolean") return errorResponse(response, 400, "INVALID_CATEGORY_STATUS", "Choose a valid category status.");
    if (request.body.active === false) {
      const [catalogueBooks, authorBooks] = await Promise.all([
        Book.countDocuments({ category: key }),
        AuthorBook.countDocuments({ category: key }),
      ]);
      if (catalogueBooks + authorBooks > 0) {
        return errorResponse(response, 409, "CATEGORY_IN_USE", "Reassign or remove books using this category before disabling it.");
      }
    }
    update.active = request.body.active;
  }
  if (!Object.keys(update).length) return errorResponse(response, 400, "EMPTY_CATEGORY_UPDATE", "Provide category labels, order, or status to update.");

  const category = await Category.findOneAndUpdate({ key }, { $set: update }, { new: true, runValidators: true });
  if (!category) return errorResponse(response, 404, "CATEGORY_NOT_FOUND", "Category not found.");
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { category: categoryDto(category.toObject(), new Map(), new Map()) } });
}
