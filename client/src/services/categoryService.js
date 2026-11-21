import { categoryDefinitions } from "../data/books.js";

const fallbackCategories = [
  { key: "All", labels: {} },
  ...categoryDefinitions.map(({ key, labels, sortOrder }) => ({ key, labels, sortOrder, active: true })),
];

export async function getCategories() {
  try {
    const response = await fetch("/api/v1/categories");
    if (!response.ok) throw new Error("Category request failed.");
    const result = await response.json();
    if (!Array.isArray(result.data?.categories)) return fallbackCategories;
    return [{ key: "All", labels: {} }, ...result.data.categories];
  } catch {
    return fallbackCategories;
  }
}

export async function getAdminCategories() {
  const response = await fetch("/api/v1/admin/categories", { credentials: "include" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || "Could not load categories.");
  return result.data.categories || [];
}

async function adminCategoryRequest(path, method, body) {
  const response = await fetch(`/api/v1/admin/categories${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || "Could not save this category.");
    error.code = result.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return result.data;
}

export const createCategory = (body) => adminCategoryRequest("", "POST", body);
export const updateCategory = (key, body) => adminCategoryRequest(`/${encodeURIComponent(key)}`, "PATCH", body);
