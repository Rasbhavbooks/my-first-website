import { isDatabaseConnected } from "../../config/database.js";

export function getHealth(_request, response) {
  response.status(200).json({
    status: "ok",
    service: "rasbhav-books-api",
    database: isDatabaseConnected() ? "connected" : "not_connected",
    timestamp: new Date().toISOString(),
  });
}
