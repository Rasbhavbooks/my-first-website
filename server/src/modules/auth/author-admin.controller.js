import mongoose from "mongoose";
import AuthorApplication from "./author-application.model.js";
import AuthorProfile from "./author-profile.model.js";
import User from "../users/user.model.js";

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function slugify(value, userId) {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const namePart = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "author";
  return `${namePart}-${String(userId).slice(-6)}`;
}

function adminApplicationDto(application) {
  const applicant = application.userId;
  return {
    id: application.id,
    authorName: application.authorName,
    biography: application.biography,
    writingLanguages: application.writingLanguages,
    genres: application.genres,
    writingSampleUrl: application.writingSampleUrl,
    status: application.status,
    adminNote: application.adminNote,
    createdAt: application.createdAt,
    reviewedAt: application.reviewedAt,
    applicant: applicant ? {
      id: applicant.id,
      displayName: applicant.displayName,
      email: applicant.email,
      role: applicant.role,
      accountStatus: applicant.accountStatus,
    } : null,
  };
}

export async function listAuthorApplications(request, response) {
  const status = typeof request.query.status === "string" ? request.query.status : "pending";
  if (!["pending", "approved", "rejected"].includes(status)) {
    return response.status(400).json({ error: { code: "INVALID_APPLICATION_STATUS", message: "Choose a valid application status." } });
  }
  const page = Math.max(1, Math.min(1000, Number.parseInt(request.query.page, 10) || 1));
  const limit = 25;
  const [applications, total] = await Promise.all([
    AuthorApplication.find({ status })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "displayName email role accountStatus"),
    AuthorApplication.countDocuments({ status }),
  ]);
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { applications: applications.map(adminApplicationDto), page, pageSize: limit, total } });
}

export async function reviewAuthorApplication(request, response) {
  const decision = request.body?.decision;
  const adminNote = typeof request.body?.adminNote === "string" ? request.body.adminNote.trim() : "";
  if (!["approved", "rejected"].includes(decision) || adminNote.length > 800) {
    return response.status(400).json({ error: { code: "INVALID_APPLICATION_DECISION", message: "Choose approve or reject and keep the note under 800 characters." } });
  }

  const session = await mongoose.startSession();
  let reviewed;
  try {
    await session.withTransaction(async () => {
      const application = await AuthorApplication.findOne({
        _id: request.params.applicationId,
        status: "pending",
      }).session(session);
      if (!application) throw httpError(404, "APPLICATION_NOT_FOUND", "A pending application was not found.");

      const user = await User.findById(application.userId).session(session);
      if (!user || user.accountStatus !== "active" || user.role !== "reader") {
        throw httpError(409, "APPLICANT_UNAVAILABLE", "This account is not eligible for author approval.");
      }

      if (decision === "approved") {
        const slug = slugify(application.authorName, user._id);
        await AuthorProfile.findOneAndUpdate(
          { userId: user._id },
          {
            $set: {
              slug,
              authorName: application.authorName,
              biography: application.biography,
              writingLanguages: application.writingLanguages,
              genres: application.genres,
              writingSampleUrl: application.writingSampleUrl,
              status: "active",
            },
          },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, session },
        );
        user.role = "author";
        await user.save({ session });
      }

      application.status = decision;
      application.adminNote = adminNote;
      application.reviewedBy = request.reader._id;
      application.reviewedAt = new Date();
      await application.save({ session });
      reviewed = {
        id: application.id,
        authorName: application.authorName,
        status: application.status,
        adminNote: application.adminNote,
        reviewedAt: application.reviewedAt,
      };
    });
  } finally {
    await session.endSession();
  }

  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { application: reviewed } });
}
