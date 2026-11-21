import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ISSUER = "Rasbhav Books";
const PERIOD_SECONDS = 30;
const CODE_DIGITS = 6;
const RECOVERY_CODE_COUNT = 10;

function encryptionKey() {
  if (!env.adminMfaEncryptionKey) throw new Error("ADMIN_MFA_ENCRYPTION_KEY is not configured.");
  return Buffer.from(env.adminMfaEncryptionKey, "hex");
}

function encodeBase32(input) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value) {
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const character of value.replace(/=+$/g, "").toUpperCase()) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error("Invalid MFA secret.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function totp(secret, timestamp) {
  const counter = BigInt(Math.floor(timestamp / 1000 / PERIOD_SECONDS));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24)
    | ((digest[offset + 1] & 255) << 16)
    | ((digest[offset + 2] & 255) << 8)
    | (digest[offset + 3] & 255);
  return String(binary % (10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
}

function safeCodeMatch(expected, supplied) {
  if (typeof supplied !== "string" || !/^\d{6}$/.test(supplied)) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function createAdminMfaEnrollment(email) {
  const secret = encodeBase32(randomBytes(20));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const ciphertext = [iv, cipher.getAuthTag(), encrypted].map((item) => item.toString("base64url")).join(".");
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${CODE_DIGITS}&period=${PERIOD_SECONDS}`;
  return { secret, encryptedSecret: ciphertext, otpauthUrl };
}

export function decryptAdminMfaSecret(ciphertext) {
  const [ivPart, tagPart, dataPart] = String(ciphertext || "").split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Invalid encrypted MFA secret.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function verifyAdminMfaCode(secret, code, timestamp = Date.now()) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  for (const adjustment of [-1, 0, 1]) {
    if (safeCodeMatch(totp(secret, timestamp + adjustment * PERIOD_SECONDS * 1000), code)) return true;
  }
  return false;
}

export function generateRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const value = randomBytes(8).toString("hex").toUpperCase();
    return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12)}`;
  });
}

export function hashRecoveryCode(code) {
  const normalized = typeof code === "string" ? code.toUpperCase().replace(/[ -]/g, "") : "";
  if (!/^[A-F0-9]{16}$/.test(normalized)) return "";
  return createHash("sha256").update(normalized).digest("hex");
}
