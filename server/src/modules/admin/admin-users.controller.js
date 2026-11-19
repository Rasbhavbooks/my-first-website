import mongoose from "mongoose";
import User from "../users/user.model.js";
import ReaderSession from "../auth/reader-session.model.js";

const ROLES = new Set(["reader", "author", "admin"]);
const STATUSES = new Set(["pending_verification", "active", "suspended"]);
const PAGE_SIZE = 30;

function escapeRegex(value) {
  return value.replace(/[.*+?^\u0024{}()|[\]\\]/g, "\\$&");
}

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

export async function listAdminUsers(request, response) {
  const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
  const role = typeof request.query.role === "string" ? request.query.role : "";
  const accountStatus = typeof request.query.status === "string" ? request.query.status : "";
  const page = request.query.page === undefined ? 1 : Number(request.query.page);

  if (search.length > 80 || (role && !ROLES.has(role)) || (accountStatus && !STATUSES.has(accountStatus))) {
    return errorResponse(response, 400, "INVALID_USER_FILTER", "Check the user search and filters.");
  }
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    return errorResponse(response, 400, "INVALID_PAGE", "Choose a valid page number.");
  }

  const filter = {};
  if (role) filter.role = role;
  if (accountStatus) filter.accountStatus = accountStatus;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ displayName: pattern }, { email: pattern }];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select("displayName email role accountStatus emailVerifiedAt createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
  ]);
  response.setHeader("Cache-Control", "no-store");
  return response.json({
    data: {
      users: users.map(({ _id, ...user }) => ({ ...user, id: String(_id) })),
      pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    },
  });
}

export async function updateAdminUserStatus(request, response) {
  const userId = request.params.userId;
  const accountStatus = request.body?.accountStatus;
  if (!mongoose.isValidObjectId(userId) || !["active", "suspended"].includes(accountStatus)) {
    return errorResponse(response, 400, "INVALID_USER_STATUS", "Choose a valid account and status.");
  }

  if (String(request.reader._id) === userId) {
    return errorResponse(response, 400, "CANNOT_CHANGE_OWN_STATUS", "You cannot change your own account status here.");
  }

  const user = await User.findById(userId).select("_id role accountStatus emailVerifiedAt");
  if (!user) return errorResponse(response, 404, "USER_NOT_FOUND", "User not found.");
  if (user.role === "admin") {
    return errorResponse(response, 403, "ADMIN_STATUS_PROTECTED", "Admin accounts cannot be changed from this user list.");
  }
  if (!user.emailVerifiedAt || user.accountStatus === "pending_verification") {
    return errorResponse(response, 409, "USER_NOT_VERIFIED", "Only email-verified accounts can be suspended or restored.");
  }
  if (user.accountStatus === accountStatus) {
    return response.json({ data: { user: { id: String(user._id), accountStatus } } });
  }
  if (
    (accountStatus === "suspended" && user.accountStatus !== "active")
    || (accountStatus === "active" && user.accountStatus !== "suspended")
  ) {
    return errorResponse(response, 409, "USER_STATUS_CHANGED", "Reload the user list and try again.");
  }

  const result = await User.updateOne(
    { _id: user._id, role: user.role, accountStatus: user.accountStatus, emailVerifiedAt: { $ne: null } },
    { $set: { accountStatus } },
    { runValidators: true },
  );
  if (result.modifiedCount !== 1) {
    return errorResponse(response, 409, "USER_STATUS_CHANGED", "Reload the user list and try again.");
  }

  if (accountStatus === "suspended") await ReaderSession.deleteMany({ userId: user._id });
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { user: { id: String(user._id), accountStatus } } });
}
