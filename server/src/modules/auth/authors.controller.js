import AuthorProfile from "./author-profile.model.js";
import Book from "../books/book.model.js";

function validOptionalHttpsUrl(value) {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function publicAuthorDto(profile) {
  return {
    slug: profile.slug,
    authorName: profile.authorName,
    biography: profile.biography,
    writingLanguages: profile.writingLanguages,
    genres: profile.genres,
    writingSampleUrl: profile.writingSampleUrl,
    websiteUrl: profile.websiteUrl,
  };
}

export async function getPublicAuthorProfile(request, response) {
  const profile = await AuthorProfile.findOne({ slug: request.params.slug, status: "active" }).lean();
  if (!profile) {
    return response.status(404).json({ error: { code: "AUTHOR_NOT_FOUND", message: "Author profile not found." } });
  }

  const books = await Book.find({ author: profile.catalogueAuthorName })
    .select("catalogueId title author language category price tone badge")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({ data: { author: publicAuthorDto(profile), books: books.map(({ _id, catalogueId, ...book }) => ({ ...book, id: catalogueId })) } });
}

export async function getMyAuthorProfile(request, response) {
  const profile = await AuthorProfile.findOne({ userId: request.reader._id, status: "active" });
  if (!profile) {
    return response.status(404).json({ error: { code: "AUTHOR_PROFILE_NOT_FOUND", message: "Your author profile was not found." } });
  }
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { author: { ...publicAuthorDto(profile), id: profile.id } } });
}

export async function updateMyAuthorProfile(request, response) {
  const profile = await AuthorProfile.findOne({ userId: request.reader._id, status: "active" });
  if (!profile) {
    return response.status(404).json({ error: { code: "AUTHOR_PROFILE_NOT_FOUND", message: "Your author profile was not found." } });
  }

  const authorName = typeof request.body?.authorName === "string" ? request.body.authorName.trim() : "";
  const biography = typeof request.body?.biography === "string" ? request.body.biography.trim() : "";
  const websiteUrl = typeof request.body?.websiteUrl === "string" ? request.body.websiteUrl.trim() : "";
  if (
    authorName.length < 2 || authorName.length > 100
    || biography.length < 40 || biography.length > 2000
    || websiteUrl.length > 500 || !validOptionalHttpsUrl(websiteUrl)
  ) {
    return response.status(400).json({ error: { code: "INVALID_AUTHOR_PROFILE", message: "Check your public name, biography, and HTTPS website link." } });
  }

  profile.authorName = authorName;
  profile.biography = biography;
  profile.websiteUrl = websiteUrl;
  await profile.save();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { author: { ...publicAuthorDto(profile), id: profile.id } } });
}
