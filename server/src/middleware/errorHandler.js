const SAFE_ERROR_CODES = new Set([
  "FILE_SCANNER_NOT_CONFIGURED", "FILE_SCANNER_TIMEOUT", "FILE_SCANNER_UNAVAILABLE", "FILE_SCAN_FAILED", "MALWARE_DETECTED",
  "STORAGE_NOT_CONFIGURED", "INVALID_FILE_SIZE", "INVALID_FILE_TYPE", "AUTHOR_BOOK_NOT_FOUND", "AUTHOR_BOOK_NOT_EDITABLE",
  "BOOK_CHAPTER_NOT_FOUND", "CHAPTER_LIMIT_REACHED", "INVALID_BOOK_CHAPTER", "AUTHOR_BOOK_NOT_REVIEWABLE",
]);

export function errorHandler(error, _request, response, _next) {
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error(error);
  response.status(status).json({
    error: {
      code: SAFE_ERROR_CODES.has(error.code) ? error.code : status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
      message: status >= 500 ? "An unexpected server error occurred." : error.message,
    },
  });
}
