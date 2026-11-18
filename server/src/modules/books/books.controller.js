import { books } from "../../../../shared/catalogue.js";

export function listBooks(_request, response) {
  response.json({ data: books });
}

export function getBook(request, response) {
  const book = books.find((entry) => entry.id === request.params.bookId);
  if (!book) {
    return response.status(404).json({
      error: { code: "BOOK_NOT_FOUND", message: "Book not found." },
    });
  }
  return response.json({ data: book });
}
