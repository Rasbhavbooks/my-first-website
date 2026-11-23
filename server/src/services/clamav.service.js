import net from "node:net";
import { env } from "../config/env.js";

function scannerError(code, message, statusCode = 503) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export async function isClamavReachable() {
  if (!env.clamavConfigured) return false;

  return new Promise((resolve) => {
    const socket = net.createConnection({ host: env.clamavHost, port: env.clamavPort });
    let response = "";
    let finished = false;
    const timeout = setTimeout(() => finish(false), 2000);

    function finish(reachable) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve(reachable);
    }

    socket.once("connect", () => socket.write(Buffer.from("zPING\0")));
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.length > 64) return finish(false);
      if (!response.includes("\0")) return;
      finish(response.slice(0, -1) === "PONG");
    });
    socket.once("error", () => finish(false));
    socket.once("close", () => finish(false));
  });
}

export async function scanBuffer(buffer) {
  if (!env.clamavConfigured) {
    throw scannerError("FILE_SCANNER_NOT_CONFIGURED", "File scanning is not configured. Uploads are disabled until the scanner is available.");
  }

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: env.clamavHost, port: env.clamavPort });
    let output = "";
    let finished = false;
    const timeout = setTimeout(() => {
      socket.destroy();
      finish(reject, scannerError("FILE_SCANNER_TIMEOUT", "The file security scan timed out."));
    }, 30000);

    function finish(callback, value) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      socket.destroy();
      callback(value);
    }

    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0"));
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });

    socket.on("data", (chunk) => {
      output += chunk.toString("utf8");
      if (!output.includes("\0") && !/(?:OK|FOUND|ERROR)\n$/.test(output)) return;
      if (output.includes(" FOUND")) {
        finish(reject, scannerError("MALWARE_DETECTED", "This file was rejected by the security scanner.", 400));
      } else if (output.includes(" OK")) {
        finish(resolve, { clean: true });
      } else {
        finish(reject, scannerError("FILE_SCAN_FAILED", "The file could not be verified by the security scanner."));
      }
    });

    socket.on("error", () => finish(reject, scannerError("FILE_SCANNER_UNAVAILABLE", "The file security scanner is unavailable.")));
    socket.on("timeout", () => finish(reject, scannerError("FILE_SCANNER_TIMEOUT", "The file security scan timed out.")));
    socket.setTimeout(30000);
  });
}
