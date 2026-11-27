import "dotenv/config";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { scanBuffer } from "../services/clamav.service.js";
import { deletePrivateObject, getPrivateObject, storePrivateObject } from "../services/r2-storage.service.js";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=",
  "base64",
);

async function verifyPrivateStorage() {
  if (process.env.NODE_ENV === "production" || !process.argv.includes("--test-bucket")) {
    throw new Error("Run in development with a dedicated private test bucket and the --test-bucket flag.");
  }
  if (!env.clamavConfigured || !env.r2Configured) {
    throw new Error("Configure ClamAV and private test R2 credentials before running this check.");
  }

  await scanBuffer(pixel);
  console.info("ClamAV scan passed.");

  const key = "private/verification/" + randomUUID() + ".png";
  try {
    await storePrivateObject({ key, body: pixel, contentType: "image/png" });
    const object = await getPrivateObject(key);
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    if (object.ContentType !== "image/png" || !bytes.equals(pixel)) {
      throw new Error("The file returned by R2 did not match the test file.");
    }
    console.info("R2 upload and download matched.");
  } finally {
    try {
      await deletePrivateObject(key);
      console.info("Removed the temporary R2 object.");
    } catch {
      throw new Error("R2 cleanup failed. Remove the test object from the private test bucket: " + key);
    }
  }
}

try {
  await verifyPrivateStorage();
} catch (error) {
  // Print a diagnostic code for service errors without logging request metadata.
  const reason = error.code || (error.$metadata ? "R2_REQUEST_FAILED" : error.message);
  console.error("Storage check failed:", reason);
  process.exitCode = 1;
}
