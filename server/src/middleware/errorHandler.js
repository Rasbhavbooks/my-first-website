export function errorHandler(error, _request, response, _next) {
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error(error);
  response.status(status).json({
    error: {
      code: status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
      message: status >= 500 ? "An unexpected server error occurred." : error.message,
    },
  });
}
