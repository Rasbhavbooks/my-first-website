import AuthorApplication from "./author-application.model.js";

const LANGUAGES = new Set(["Gujarati", "Hindi", "English"]);

function cleanList(value, limit, maxLength) {
  if (!Array.isArray(value)) return null;
  const cleaned = [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= maxLength))];
  return cleaned.length <= limit ? cleaned : null;
}

function validHttpsUrl(value) {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function applicationDto(application) {
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
    updatedAt: application.updatedAt,
    reviewedAt: application.reviewedAt,
  };
}

export async function getMyAuthorApplication(request, response) {
  const application = await AuthorApplication.findOne({ userId: request.reader._id });
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { application: application ? applicationDto(application) : null } });
}

export async function submitAuthorApplication(request, response) {
  if (request.reader.role !== "reader") {
    return response.status(409).json({ error: { code: "AUTHOR_APPLICATION_UNAVAILABLE", message: "This account cannot submit an author application." } });
  }

  const authorName = typeof request.body?.authorName === "string" ? request.body.authorName.trim() : "";
  const biography = typeof request.body?.biography === "string" ? request.body.biography.trim() : "";
  const writingLanguages = cleanList(request.body?.writingLanguages, 3, 20);
  const genres = cleanList(request.body?.genres ?? [], 10, 40);
  const writingSampleUrl = typeof request.body?.writingSampleUrl === "string" ? request.body.writingSampleUrl.trim() : null;
  const validLanguages = writingLanguages && writingLanguages.length > 0 && writingLanguages.every((language) => LANGUAGES.has(language));

  if (
    authorName.length < 2 || authorName.length > 100
    || biography.length < 40 || biography.length > 2000
    || !validLanguages || !genres
    || writingSampleUrl === null || writingSampleUrl.length > 500 || !validHttpsUrl(writingSampleUrl)
  ) {
    return response.status(400).json({ error: { code: "INVALID_AUTHOR_APPLICATION", message: "Check the author name, biography, languages, genres, and HTTPS sample link." } });
  }

  const existing = await AuthorApplication.findOne({ userId: request.reader._id });
  if (existing?.status === "pending" || existing?.status === "approved") {
    return response.status(409).json({ error: { code: "APPLICATION_ALREADY_EXISTS", message: "An application is already pending or approved." } });
  }

  const fields = {
    authorName,
    biography,
    writingLanguages,
    genres,
    writingSampleUrl,
    status: "pending",
    adminNote: "",
    reviewedBy: null,
    reviewedAt: null,
  };

  try {
    const application = existing
      ? await AuthorApplication.findOneAndUpdate(
        { _id: existing._id, status: "rejected" },
        { $set: fields },
        { new: true, runValidators: true },
      )
      : await AuthorApplication.create({ ...fields, userId: request.reader._id });
    if (!application) {
      return response.status(409).json({ error: { code: "APPLICATION_ALREADY_EXISTS", message: "An application is already pending or approved." } });
    }
    response.setHeader("Cache-Control", "no-store");
    return response.status(201).json({ data: { application: applicationDto(application) } });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ error: { code: "APPLICATION_ALREADY_EXISTS", message: "An application is already pending or approved." } });
    }
    throw error;
  }
}
