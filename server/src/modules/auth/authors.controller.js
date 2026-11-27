import DigitalBookOrder from "../orders/order.model.js";
import AuthorProfile from "./author-profile.model.js";
import Book from "../books/book.model.js";
import AuthorFollow from "./author-follow.model.js";
import AuthorBook from "../books/author-book.model.js";

function validOptionalHttpsUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
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
    profilePhotoUrl: profile.profilePhotoUrl,
    coverImageUrl: profile.coverImageUrl,
    followName: profile.catalogueAuthorName,
  };
}

async function listAuthorCatalogueBooks(profile) {
  const featuredBookIds = profile.featuredBookIds || [];
  const [recentBooks, featuredBooks] = await Promise.all([
    Book.find({ author: profile.catalogueAuthorName })
      .select("catalogueId title author language category")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    featuredBookIds.length
      ? Book.find({ author: profile.catalogueAuthorName, catalogueId: { $in: featuredBookIds } })
        .select("catalogueId title author language category")
        .lean()
      : Promise.resolve([]),
  ]);
  const uniqueBooks = new Map([...recentBooks, ...featuredBooks].map((book) => [book.catalogueId, book]));
  return [...uniqueBooks.values()].map(({ _id, catalogueId, ...book }) => ({ ...book, id: catalogueId }));
}

async function getPublicAuthorStats(profile) {
  const authorKey = profile.catalogueAuthorName.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  const [followerIds, catalogueBookCount] = await Promise.all([
    AuthorFollow.distinct("userId", { $or: [{ authorProfileId: profile._id }, { authorKey }] }),
    Book.countDocuments({ author: profile.catalogueAuthorName }),
  ]);
  return { followerCount: followerIds.length, catalogueBookCount };
}

async function getAuthorStats(profile) {
  const authorKey = profile.catalogueAuthorName.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  const followFilter = { $or: [{ authorProfileId: profile._id }, { authorKey }] };
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const [followerIds, newFollowers7Days, newFollowers30Days, catalogueBookCount, draftCount, submittedCount, approvedCount, changesRequestedCount] = await Promise.all([
    AuthorFollow.distinct("userId", followFilter),
    AuthorFollow.distinct("userId", { $and: [followFilter, { createdAt: { $gte: sevenDaysAgo } }] }),
    AuthorFollow.distinct("userId", { $and: [followFilter, { createdAt: { $gte: thirtyDaysAgo } }] }),
    Book.countDocuments({ author: profile.catalogueAuthorName }),
    AuthorBook.countDocuments({ authorId: profile.userId, status: "draft" }),
    AuthorBook.countDocuments({ authorId: profile.userId, status: "submitted" }),
    AuthorBook.countDocuments({ authorId: profile.userId, status: "approved" }),
    AuthorBook.countDocuments({ authorId: profile.userId, status: "rejected" }),
  ]);
  return {
    followerCount: followerIds.length,
    newFollowers7Days: newFollowers7Days.length,
    newFollowers30Days: newFollowers30Days.length,
    catalogueBookCount,
    draftCount,
    submittedCount,
    approvedCount,
    changesRequestedCount,
  };
}

export async function getPublicAuthorProfile(request, response) {
  const profile = await AuthorProfile.findOne({ slug: request.params.slug, status: "active" }).lean();
  if (!profile) {
    return response.status(404).json({ error: { code: "AUTHOR_NOT_FOUND", message: "Author profile not found." } });
  }

  const featuredBookIds = profile.featuredBookIds || [];
  const [recentBooks, selectedBooks] = await Promise.all([
    Book.find({ author: profile.catalogueAuthorName })
      .select("catalogueId title author language category price tone badge")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    featuredBookIds.length
      ? Book.find({ author: profile.catalogueAuthorName, catalogueId: { $in: featuredBookIds } })
        .select("catalogueId title author language category price tone badge")
        .lean()
      : Promise.resolve([]),
  ]);
  const uniqueBooks = new Map([...recentBooks, ...selectedBooks].map((book) => [book.catalogueId, book]));
  const bookDtos = [...uniqueBooks.values()].map(({ _id, catalogueId, ...book }) => ({ ...book, id: catalogueId }));
  const featuredById = new Map(bookDtos.map((book) => [book.id, book]));
  const featuredBooks = (profile.featuredBookIds || []).map((id) => featuredById.get(id)).filter(Boolean);
  const stats = await getPublicAuthorStats(profile);
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({
    data: {
      author: { ...publicAuthorDto(profile), ...stats },
      books: bookDtos,
      featuredBooks,
    },
  });
}

export async function getAuthorOrderShare(authorId) {
  const [summary] = await DigitalBookOrder.aggregate([
    { $match: { authorBeneficiaryId: authorId, currency: "INR", status: { $in: ["paid", "refund_pending"] } } },
    { $group: { _id: null, amountPaise: { $sum: "$authorPricePaise" }, orderCount: { $sum: 1 } } },
    { $project: { _id: 0, amountPaise: 1, orderCount: 1 } },
  ]);
  return summary ?? { amountPaise: 0, orderCount: 0 };
}

export async function getMyAuthorProfile(request, response) {
  const profile = await AuthorProfile.findOne({ userId: request.reader._id, status: "active" });
  if (!profile) {
    return response.status(404).json({ error: { code: "AUTHOR_PROFILE_NOT_FOUND", message: "Your author profile was not found." } });
  }
  const [stats, catalogueBooks, orderShare] = await Promise.all([
    getAuthorStats(profile), listAuthorCatalogueBooks(profile), getAuthorOrderShare(profile.userId),
  ]);
  const availableBookIds = new Set(catalogueBooks.map((book) => book.id));
  const featuredBookIds = (profile.featuredBookIds || []).filter((id) => availableBookIds.has(id));
  response.setHeader("Cache-Control", "no-store");
  return response.json({
    data: {
      author: { ...publicAuthorDto(profile), id: profile.id, featuredBookIds, ...stats, orderShare },
      catalogueBooks,
    },
  });
}

export async function updateMyAuthorProfile(request, response) {
  const profile = await AuthorProfile.findOne({ userId: request.reader._id, status: "active" });
  if (!profile) {
    return response.status(404).json({ error: { code: "AUTHOR_PROFILE_NOT_FOUND", message: "Your author profile was not found." } });
  }

  const authorName = typeof request.body?.authorName === "string" ? request.body.authorName.trim() : "";
  const biography = typeof request.body?.biography === "string" ? request.body.biography.trim() : "";
  const websiteUrl = typeof request.body?.websiteUrl === "string" ? request.body.websiteUrl.trim() : "";
  const profilePhotoUrl = typeof request.body?.profilePhotoUrl === "string" ? request.body.profilePhotoUrl.trim() : "";
  const coverImageUrl = typeof request.body?.coverImageUrl === "string" ? request.body.coverImageUrl.trim() : "";
  const rawFeaturedBookIds = request.body?.featuredBookIds;
  let featuredBookIds = profile.featuredBookIds || [];
  if (rawFeaturedBookIds !== undefined) {
    if (
      !Array.isArray(rawFeaturedBookIds)
      || rawFeaturedBookIds.length > 3
      || rawFeaturedBookIds.some((id) => typeof id !== "string" || !id.trim() || id.trim().length > 120)
    ) {
      return response.status(400).json({ error: { code: "INVALID_FEATURED_BOOKS", message: "Choose up to three books from your catalogue." } });
    }
    featuredBookIds = rawFeaturedBookIds.map((id) => id.trim());
    if (new Set(featuredBookIds).size !== featuredBookIds.length) {
      return response.status(400).json({ error: { code: "INVALID_FEATURED_BOOKS", message: "Choose each featured book only once." } });
    }
    const validIds = await Book.distinct("catalogueId", {
      author: profile.catalogueAuthorName,
      catalogueId: { $in: featuredBookIds },
    });
    if (validIds.length !== featuredBookIds.length) {
      return response.status(400).json({ error: { code: "INVALID_FEATURED_BOOKS", message: "Featured books must belong to your public catalogue." } });
    }
  }
  if (
    authorName.length < 2 || authorName.length > 100
    || biography.length < 40 || biography.length > 2000
    || websiteUrl.length > 500 || !validOptionalHttpsUrl(websiteUrl)
    || profilePhotoUrl.length > 500 || !validOptionalHttpsUrl(profilePhotoUrl)
    || coverImageUrl.length > 500 || !validOptionalHttpsUrl(coverImageUrl)
  ) {
    return response.status(400).json({ error: { code: "INVALID_AUTHOR_PROFILE", message: "Check your public name, biography, and HTTPS website or image links." } });
  }

  profile.authorName = authorName;
  profile.biography = biography;
  profile.websiteUrl = websiteUrl;
  profile.profilePhotoUrl = profilePhotoUrl;
  profile.coverImageUrl = coverImageUrl;
  profile.featuredBookIds = featuredBookIds;
  await profile.save();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { author: { ...publicAuthorDto(profile), id: profile.id, ...await getAuthorStats(profile) } } });
}
