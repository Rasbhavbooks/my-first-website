import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

let client;

function getClient() {
  if (!env.r2Configured) {
    const error = new Error("Private file storage is not configured.");
    error.statusCode = 503;
    error.code = "STORAGE_NOT_CONFIGURED";
    throw error;
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
      },
    });
  }
  return client;
}

export async function storePrivateObject({ key, body, contentType }) {
  return getClient().send(new PutObjectCommand({
    Bucket: env.r2BucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentLength: body.length,
  }));
}

export async function getPrivateObject(key) {
  return getClient().send(new GetObjectCommand({ Bucket: env.r2BucketName, Key: key }));
}

export async function deletePrivateObject(key) {
  if (!env.r2Configured || !key) return;
  return getClient().send(new DeleteObjectCommand({ Bucket: env.r2BucketName, Key: key }));
}
