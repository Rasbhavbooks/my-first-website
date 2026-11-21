import mongoose from "mongoose";
import AuthorProfile from "./author-profile.model.js";
import AuthorFollow from "../auth/author-follow.model.js";
import AuthorBook from "../books/author-book.model.js";
import Book from "../books/book.model.js";

const PAGE_SIZE = 25;

function escapeRegex(value) {
  const specialCharacters = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);
  return [...value].map((character) => specialCharacters.has(character) ? "\\" + character : character).join("");
}

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

export async function listAdminAuthors(request, response) {
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const status = typeof request.query.status === "string" ? request.query.status : "";
  const page = request.query.page === undefined ? 1 : Number(request.query.page);
  if (search.length > 80 || (status && !["active", "suspended"].includes(status))) {
    return errorResponse(response, 400, "INVALID_AUTHOR_FILTER", "Check the author search and status.");
  }
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    return errorResponse(response, 400, "INVALID_PAGE", "Choose a valid page number.");
  }

  const filter = {};
  if (status) filter.status = status;
  const pattern = search ? new RegExp(escapeRegex(search), "i") : null;
  if (pattern) filter.$or = [{ authorName: pattern }, { catalogueAuthorName: pattern }];

  const [total, profiles] = await Promise.all([
    AuthorProfile.countDocuments(filter),
    AuthorProfile.find(filter)
      .select("userId slug authorName catalogueAuthorName biography writingLanguages genres status createdAt updatedAt")
      .populate("userId", "displayName email accountStatus")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
  ]);

  const authorKeys = profiles.map((profile) => profile.catalogueAuthorName.trim().split(" ").filter(Boolean).join(" ").toLocaleLowerCase("en-US"));
  const profileIds = profiles.map((profile) => profile._id);
  const applicantIds = profiles.map((profile) => profile.userId?._id).filter(Boolean);
  const catalogueNames = [...new Set(profiles.map((profile) => profile.catalogueAuthorName))];
  const [followerGroups, catalogueGroups, workflowGroups] = await Promise.all([
    AuthorFollow.aggregate([
      { $match: { $or: [{ authorProfileId: { $in: profileIds } }, { authorKey: { $in: authorKeys } }] } },
      { $addFields: { matchedProfileId: { $switch: { branches: profiles.map((profile, index) => ({
        case: { $or: [{ $eq: ["$authorProfileId", profile._id] }, { $eq: ["$authorKey", authorKeys[index]] }] },
        then: String(profile._id),
      })), default: null } } } },
      { $match: { matchedProfileId: { $ne: null } } },
      { $group: { _id: "$matchedProfileId", userIds: { $addToSet: "$userId" } } },
    ]),
    Book.aggregate([
      { $match: { author: { $in: catalogueNames } } },
      { $group: { _id: "$author", count: { $sum: 1 } } },
    ]),
    AuthorBook.aggregate([
      { $match: { authorId: { $in: applicantIds }, status: { $in: ["draft", "submitted"] } } },
      { $group: { _id: { authorId: "$authorId", status: "$status" }, count: { $sum: 1 } } },
    ]),
  ]);
  const followersByProfile = new Map(followerGroups.map((group) => [group._id, group.userIds.length]));
  const booksByName = new Map(catalogueGroups.map((group) => [group._id, group.count]));
  const workflowByAuthor = new Map(workflowGroups.map((group) => [`${String(group._id.authorId)}:${group._id.status}`, group.count]));
  const authors = profiles.map((profile) => ({
    id: String(profile._id),
    slug: profile.slug,
    authorName: profile.authorName,
    biography: profile.biography,
    writingLanguages: profile.writingLanguages,
    genres: profile.genres,
    status: profile.status,
    createdAt: profile.createdAt,
    applicant: profile.userId ? {
      id: String(profile.userId._id),
      displayName: profile.userId.displayName,
      email: profile.userId.email,
      accountStatus: profile.userId.accountStatus,
    } : null,
    stats: {
      followerCount: followersByProfile.get(String(profile._id)) || 0,
      catalogueBookCount: booksByName.get(profile.catalogueAuthorName) || 0,
      draftCount: workflowByAuthor.get(`${String(profile.userId?._id)}:draft`) || 0,
      submittedCount: workflowByAuthor.get(`${String(profile.userId?._id)}:submitted`) || 0,
    },
  }));

  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { authors, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } } });
}

export async function updateAdminAuthorStatus(request, response) {
  const authorId = request.params.authorId;
  const status = request.body?.status;
  if (!mongoose.isValidObjectId(authorId) || !["active", "suspended"].includes(status)) {
    return errorResponse(response, 400, "INVALID_AUTHOR_STATUS", "Choose a valid author and status.");
  }
  const profile = await AuthorProfile.findById(authorId).populate("userId", "accountStatus");
  if (!profile) return errorResponse(response, 404, "AUTHOR_NOT_FOUND", "Author profile not found.");
  if (status === "active" && profile.userId?.accountStatus !== "active") {
    return errorResponse(response, 409, "AUTHOR_ACCOUNT_INACTIVE", "Restore the author's account before restoring the profile.");
  }
  if (profile.status === status) {
    response.setHeader("Cache-Control", "no-store");
    return response.json({ data: { author: { id: String(profile._id), status } } });
  }

  const result = await AuthorProfile.updateOne(
    { _id: profile._id, status: profile.status },
    { $set: { status } },
    { runValidators: true },
  );
  if (result.modifiedCount !== 1) {
    return errorResponse(response, 409, "AUTHOR_STATUS_CHANGED", "Reload the author list and try again.");
  }
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { author: { id: String(profile._id), status } } });
}
