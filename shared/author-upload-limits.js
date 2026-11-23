export const DEFAULT_AUTHOR_UPLOAD_LIMITS_MB = Object.freeze({
  cover: 5,
  manuscript: 25,
});

export const MAX_AUTHOR_UPLOAD_LIMITS_MB = Object.freeze({
  cover: 10,
  manuscript: 25,
});

export function isValidAuthorUploadLimits(value) {
  return Boolean(value)
    && Number.isInteger(value.coverMaxMb)
    && value.coverMaxMb >= 1
    && value.coverMaxMb <= MAX_AUTHOR_UPLOAD_LIMITS_MB.cover
    && Number.isInteger(value.manuscriptMaxMb)
    && value.manuscriptMaxMb >= 1
    && value.manuscriptMaxMb <= MAX_AUTHOR_UPLOAD_LIMITS_MB.manuscript;
}
