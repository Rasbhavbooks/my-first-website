export async function getPopularSearchTrends() {
  try {
    const response = await fetch("/api/v1/search-trends", { cache: "no-store" });
    if (!response.ok) return [];
    const result = await response.json();
    return Array.isArray(result.data) ? result.data.filter((term) => typeof term === "string") : [];
  } catch {
    return [];
  }
}

export async function recordSearchTrend(term) {
  try {
    await fetch("/api/v1/search-trends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term, consent: true }),
    });
  } catch {
    // Trend collection is optional; a network failure must not interrupt search.
  }
}
