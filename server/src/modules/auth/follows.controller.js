import { isDatabaseConnected } from "../../config/database.js";
import Book from "../books/book.model.js";
import AuthorFollow from "./author-follow.model.js";
import AuthorProfile from "./author-profile.model.js";

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
  const follows = await AuthorFollow.find({ userId: request.reader._id })
    .sort({ authorName: 1 })
    .populate("authorProfileId", "slug")
    .lean();
  return response.json({
    data: {
      authors: follows.map(({ authorKey, authorName, authorProfileId, createdAt }) => ({
        authorKey,
        authorName,
        authorSlug: authorProfileId?.slug || (authorKey.startsWith("profile:") ? authorKey.slice("profile:".length) : ""),
        followedAt: createdAt,
      })),
    },
  });
}

async function saveProfileFollow(request, response, profile) {
  const authorKey = "profile-id:" + String(profile._id);
  const legacyKeys = [...new Set([profile.authorName, profile.catalogueAuthorName].map(normalizeAuthorName))];
  const [existing, legacyFollows] = await Promise.all([
    AuthorFollow.findOne({ userId: request.reader._id, authorKey }),
    AuthorFollow.find({ userId: request.reader._id, authorKey: { $in: legacyKeys } }).sort({ _id: 1 }),
  ]);

  if (existing) {
    if (legacyFollows.length) {
      await AuthorFollow.deleteMany({ _id: { $in: legacyFollows.map((follow) => follow._id) } });
    }
    return response.json({ data: { author: { authorKey, authorName: existing.authorName, authorSlug: profile.slug } } });
  }

  const legacy = legacyFollows[0];
  try {
    const follow = legacy
      ? await AuthorFollow.findOneAndUpdate(
        { _id: legacy._id, userId: request.reader._id },
        { $set: { authorKey, authorName: profile.authorName, authorProfileId: profile._id } },
        { new: true, runValidators: true },
      )
      : await AuthorFollow.findOneAndUpdate(
        { userId: request.reader._id, authorKey },
        { $setOnInsert: { userId: request.reader._id, authorKey, authorName: profile.authorName, authorProfileId: profile._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    const duplicates = legacyFollows.filter((item) => !legacy || String(item._id) !== String(legacy._id));
    if (duplicates.length) await AuthorFollow.deleteMany({ _id: { $in: duplicates.map((item) => item._id) } });
    return response.status(201).json({ data: { author: { authorKey: follow.authorKey, authorName: follow.authorName, authorSlug: profile.slug } } });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const follow = await AuthorFollow.findOne({ userId: request.reader._id, authorKey });
    if (!follow) throw error;
    if (legacyFollows.length) {
      await AuthorFollow.deleteMany({ _id: { $in: legacyFollows.map((item) => item._id) } });
    }
    return response.json({ data: { author: { authorKey, authorName: follow.authorName, authorSlug: profile.slug } } });
  }
}

export async function followAuthorProfile(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const slug = typeof request.params.slug === "string" ? request.params.slug.trim().toLowerCase() : "";
  if (!slug || !/^[a-z0-9-]{1,140}$/.test(slug)) {
    return response.status(400).json({ error: { code: "INVALID_AUTHOR", message: "A valid author profile is required." } });
  }
  const profile = await AuthorProfile.findOne({ slug, status: "active" })
    .select("_id slug authorName catalogueAuthorName");
  if (!profile) return response.status(404).json({ error: { code: "AUTHOR_NOT_FOUND", message: "Author profile not found." } });
  return saveProfileFollow(request, response, profile);
}

export async function unfollowAuthorProfile(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const slug = typeof request.params.slug === "string" ? request.params.slug.trim().toLowerCase() : "";
  if (!slug || !/^[a-z0-9-]{1,140}$/.test(slug)) {
    return response.status(400).json({ error: { code: "INVALID_AUTHOR", message: "A valid author profile is required." } });
  }
  const profile = await AuthorProfile.findOne({ slug }).select("_id authorName catalogueAuthorName");
  const keys = profile ? ["profile-id:" + String(profile._id)] : ["profile:" + slug];
  if (profile) keys.push(normalizeAuthorName(profile.authorName), normalizeAuthorName(profile.catalogueAuthorName));
  await AuthorFollow.deleteMany({
    userId: request.reader._id,
    $or: [
      { authorKey: { $in: keys } },
      ...(profile ? [{ authorProfileId: profile._id }] : []),
    ],
  });
  return response.json({ data: { authorSlug: slug, following: false } });
}

export async function followAuthor(request, response) {
  if (!isDatabaseConnected()) return databaseUnavailable(response);
  const authorName = typeof request.body?.authorName === "string" ? request.body.authorName.trim().replace(/\s+/g, " ") : "";
  if (!authorName || authorName.length > 120) {
    return response.status(400).json({
      error: { code: "INVALID_AUTHOR", message: "Enter a valid author name." },
    });
  }

  const authorPattern = new RegExp("^" + escapeRegex(authorName) + "$", "i");
  const profile = await AuthorProfile.findOne({
    status: "active",
    $or: [{ authorName: authorPattern }, { catalogueAuthorName: authorPattern }],
  }).select("_id slug authorName catalogueAuthorName");
  if (profile) return saveProfileFollow(request, response, profile);

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
